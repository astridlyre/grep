const { Transform } = require('stream')
const { State } = require('./state')
const { notEmpty, join, isTerminator } = require('./utils')

const ADD_CHAR = 'ADD_CHAR'
const INCREMENT_LINE = 'INCREMENT_LINE'
const CLEAR_BUFFER = 'CLEAR_BUFFER'

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

module.exports = { LineReader }
