const { Transform, Readable } = require('stream')
const { createReadStream } = require('fs')
const { LineReader } = require('./lineReader')

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

module.exports = { createFileReaderStreams }
