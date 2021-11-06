#!/usr/bin/env node
/*
 *   __ _ _ __ ___ _ __
 *  / _` | '__/ _ \ '_ \
 * | (_| | | |  __/ |_) |
 *  \__, |_|  \___| .__/
 *  |___/         |_|
 *
 * FIND STUFF GOOD
 */
const { createReadStream } = require('fs')
const { Transform, Readable } = require('stream')

/*
 * State takes an initialState and a reducer function to maintain a centralized
 * location for data.
 */
class State {
  #state
  #reducer
  constructor(initialState, reducer) {
    this.#state = initialState
    this.#reducer = reducer
  }
  set(state) {
    this.#state = state
  }
  get() {
    return this.#state
  }
  dispatch(action) {
    this.set(this.#reducer(this.#state, action))
    return this
  }
}

/*
 * Constants
 */
const ARGS = process.argv.slice(2)
const ADD_CHAR = 'ADD_CHAR'
const INCREMENT_LINE = 'INCREMENT_LINE'
const CLEAR_BUFFER = 'CLEAR_BUFFER'

const VALID_OPTIONS = {
  '-n': { addLineNumber: true },
  '-l': { printFileNames: true },
  '-i': { ignoreCase: true },
  '-v': { reverseFiles: true },
  '-x': { matchEntireLine: true },
}

const BASE_SETTINGS = {
  addLineNumber: false,
  printFileNames: false,
  ignoreCase: false,
  reverseFiles: false,
  matchEntireLine: false,
}

/*
 * Misc helper functions
 */
const curry = fn =>
  function innerCurry(...args1) {
    return args1.length >= fn.length
      ? fn.apply(this, args1)
      : (...args2) =>
          args1.length + args2.length >= fn.length
            ? fn.apply(this, args1.concat(args2))
            : innerCurry(fn)(...args1, ...args2)
  }

const not =
  fn =>
  (...args) =>
    !fn(...args)

const and =
  (...fns) =>
  x =>
    fns.reduce((result, f) => (result && f(x)) || false, true)

const isString = x => typeof x === 'string'
const isArray = x => Array.isArray(x)
const join = curry((sep, arr) => arr.join(sep))
const startsWith = curry((a, b) => b.startsWith(a))
const isTerminator = char => char === '\r' || char === '\n'
const isEmpty = x => x.length === 0
const notEmpty = not(isEmpty)
const rest = arr => arr.slice(1)
const includes = curry((str, arr) => arr.includes(str))
const keys = obj => Object.keys(obj)
const get = p => x => x[p]
const unique = arr => Array.from(new Set(arr))
const every = curry((fn, arr) => arr.every(fn))
const forEach = curry((fn, arr) => arr.forEach(fn))
const filter = curry((fn, arr) => arr.filter(fn))
const reduce = curry((fn, initialValue, arr) => arr.reduce(fn, initialValue))
const demethodize = Function.prototype.bind.bind(Function.prototype.call)

const compose2 = (f, g) =>
  function innerCompose(x) {
    return f.call(this, g.call(this, x))
  }

const compose = (...fns) => fns.reduce(compose2)

/*
 * Reducers
 */
const readLineReducer = (state, action) => {
  switch (action.type) {
    case INCREMENT_LINE:
      return { ...state, lineCount: state.lineCount + action.payload }
    case ADD_CHAR:
      return { ...state, buffer: state.buffer.concat(action.payload) }
    case CLEAR_BUFFER:
      return { ...state, buffer: [] }
    default:
      return state
  }
}

/*
 * Action creators
 */
const addChar = payload => ({ type: ADD_CHAR, payload })
const incrementLineCount = () => ({ type: INCREMENT_LINE, payload: 1 })
const clearBuffer = () => ({ type: CLEAR_BUFFER, payload: [] })

/*
 * Line represents a line of data to be scanned for a match
 */
class Line {
  constructor({ line, lineNumber, fileName }) {
    this.line = line
    this.lineNumber = lineNumber
    this.fileName = fileName
  }

  match(re) {
    return this.line.match(re) || []
  }

  static of(line) {
    return new Line(line)
  }
}

/*
 * LineReader transforms input data into a series of Lines
 */
class LineReader extends Transform {
  #fileName
  #state

  constructor(fileName) {
    super({ objectMode: true })
    this.#state = new State({ lineCount: 0, buffer: [] }, readLineReducer)
    this.#fileName = fileName
  }

  pushLine() {
    const { buffer, lineCount } = this.#state.get()
    if (notEmpty(buffer)) {
      this.push(
        Line.of({
          line: join('', buffer),
          lineNumber: lineCount,
          fileName: this.#fileName,
        })
      )
      this.#state.dispatch(clearBuffer())
    }
  }

  _transform(chunk, _, callback) {
    for (const char of chunk.toString()) {
      if (!isTerminator(char)) {
        this.#state.dispatch(addChar(char))
      } else {
        this.#state.dispatch(incrementLineCount())
        this.pushLine(this)
      }
    }
    callback()
  }

  _flush(callback) {
    this.#state.dispatch(incrementLineCount())
    this.pushLine(this)
    callback()
  }

  static for(fileName) {
    return new LineReader(fileName)
  }
}

/*
 * Matcher takes a pattern and creates a RegExp matcher Transform stream
 * to process Lines of data
 */

class Matcher {
  static registry = []

  static register(matcher) {
    Matcher.registry.push(matcher)
    return matcher
  }

  static for(settings) {
    for (const matcher of Matcher.registry) {
      if (matcher.canHandle(settings)) return new matcher(settings)
    }
    throw new Error('No matchers for available settings')
  }

  static createPattern(settings) {
    return settings.matchEntireLine ? `^${settings.pattern}$` : `${settings.pattern}`
  }

  static createFlags(settings) {
    return settings.ignoreCase ? 'ig' : 'g'
  }

  static createRegExp(settings) {
    return new RegExp(Matcher.createPattern(settings), Matcher.createFlags(settings))
  }
}

/*
 * Normal matcher is the default matcher for grep, it outputs any lines which
 * match the provided pattern.
 */
const NormalMatcher = Matcher.register(
  class NormalMatcher extends Transform {
    #regExp

    constructor(settings) {
      super({ objectMode: true })
      this.#regExp = Matcher.createRegExp(settings)
      this.settings = settings
    }

    _transform(line, _, callback) {
      const matches = line.match(this.#regExp)
      if (notEmpty(matches)) {
        this.push({
          ...line,
          matchIndex: this.#regExp.lastIndex - this.settings.pattern.length,
        })
      }
      callback()
    }

    static canHandle({ reverseFiles }) {
      return reverseFiles === false
    }
  }
)

/*
 * Reverse matcher outputs lines that *do not* match the given pattern
 */
const ReverseMatcher = Matcher.register(
  class ReverseMatcher extends Transform {
    #regExp

    constructor(settings) {
      super({ objectMode: true })
      this.#regExp = Matcher.createRegExp(settings)
    }

    _transform(line, _, callback) {
      const matches = line.match(this.#regExp)
      if (isEmpty(matches)) {
        this.push({ ...line })
      }
      callback()
    }

    static canHandle({ reverseFiles }) {
      return reverseFiles === true
    }
  }
)

/*
 * Output formatter prints the output of the grep to stdout
 */
class Formatter {
  static registry = []

  static register(formatter) {
    Formatter.registry.push(formatter)
    return formatter
  }

  static for(settings) {
    for (const formatter of Formatter.registry) {
      if (formatter.canHandle(settings)) return new formatter(settings)
    }
    throw new Error('No formatter for available settings')
  }

  static prependFileName(fileName, fileNames) {
    return fileNames.length > 1 ? `${fileName}:` : ''
  }

  static prependLineNumber(lineNumber, addLineNumber) {
    return addLineNumber ? `${lineNumber}:` : ''
  }

  static formatLine(settings, match) {
    const { addLineNumber, fileNames } = settings
    const { line, lineNumber, fileName } = match
    return (
      `${Formatter.prependFileName(fileName, fileNames)}` +
      `${Formatter.prependLineNumber(lineNumber, addLineNumber)}${line}`
    )
  }
}

/*
 * Prints only the unique file names of matches
 */
const FileNameOnlyFormatter = Formatter.register(
  class FileNameOnlyFormatter extends Transform {
    #matches

    constructor() {
      super({ objectMode: true })
      this.#matches = []
    }

    _transform(match, _, callback) {
      this.#matches.push(get('fileName')(match))
      callback()
    }

    _flush(callback) {
      const fileNames = compose(join('\n'), unique)(this.#matches)
      console.log(fileNames)
      callback()
    }

    static canHandle({ printFileNames }) {
      return printFileNames === true
    }
  }
)

/**
 * Line formatter prints each matching line according to the settings
 */
const LineFormatter = Formatter.register(
  class LineFormatter extends Transform {
    constructor(settings) {
      super({ objectMode: true })
      this.settings = settings
    }

    _transform(match, _, callback) {
      console.log(Formatter.formatLine(this.settings, match))
      callback()
    }

    static canHandle({ printFileNames }) {
      return printFileNames === false
    }
  }
)

/*
 * File reader streams multiple files into one output
 */
class FileReader extends Transform {
  #destStream

  constructor(destStream) {
    super({ objectMode: true })
    this.#destStream = destStream
  }

  _transform(filename, _enc, done) {
    const src = createReadStream(filename).pipe(LineReader.for(filename))
    src.pipe(this.#destStream, { end: false })
    src.on('error', done)
    src.on('end', done)
  }

  static to(destStream) {
    return new FileReader(destStream)
  }
}

/*
 * Create a stream of FileReaders from settings, and pipe to destStream
 */
const createFileReaderStreams = (destStream, settings) =>
  new Promise((resolve, reject) => {
    Readable.from(settings.fileNames)
      .pipe(FileReader.to(destStream))
      .on('error', reject)
      .on('finish', () => {
        destStream.end()
        resolve()
      })
  })

/*
 * Functions for processing command line arguments
 */
const isValidArgs = str => startsWith('-', str) && includes(str, keys(VALID_OPTIONS))
const firstNonArg = arr => arr.find(not(isValidArgs))
const restNonArgs = compose(rest, filter(not(isValidArgs)))

const parseSettings = args =>
  reduce(
    (result, arg) => Object.assign(result, VALID_OPTIONS[arg]),
    BASE_SETTINGS,
    filter(isValidArgs, args)
  )

const addFilenames = args => settings => ({ ...settings, fileNames: restNonArgs(args) })
const addSearchPattern = args => settings => ({ ...settings, pattern: firstNonArg(args) })

/*
 * Validate pattern and filename
 */
class SettingsValidator {
  static isValidFilename = and(notEmpty, isString)
  static isValidPattern = and(notEmpty, isString)

  static validate(settings) {
    const errors = []

    if (!SettingsValidator.isValidPattern(settings.pattern)) {
      errors.push({ message: `Invalid pattern ${settings.pattern}` })
    }

    if (!isArray(settings.fileNames)) {
      errors.push({ message: 'No filenames supplied' })
    }

    if (!every(SettingsValidator.isValidFilename, settings.fileNames)) {
      errors.push({
        message: `Invalid filenames ${filter(
          not(SettingsValidator.isValidFilename),
          settings.fileNames
        )}`,
      })
    }

    return errors
  }
}

/*
 * Error handler to print where things went ary
 */
const stringify = x => JSON.stringify(x, null, '  ')
const handleErrors = errors => {
  console.error('One or more errors have occurred:')
  forEach(compose(demethodize(console.error), stringify), errors)
  process.exit(1)
}

/*
 * Main function processes the command line settings, validates them for errors
 * and then performs the pattern matching on the file streams.
 */
;(async function main() {
  const settings = compose(
    addFilenames(ARGS),
    addSearchPattern(ARGS),
    parseSettings
  )(ARGS)

  const errors = SettingsValidator.validate(settings)

  if (notEmpty(errors)) {
    return handleErrors(errors)
  }

  const outputStream = Matcher.for(settings)
  outputStream.pipe(Formatter.for(settings))

  try {
    return await createFileReaderStreams(outputStream, settings)
  } catch (err) {
    return handleErrors(err)
  }
})()
