const { Transform } = require('stream')
const { get, unique, join, compose } = require('./utils')

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

module.exports = { Formatter }
