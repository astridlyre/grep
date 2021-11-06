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
const { Matcher } = require('./src/matcher')
const { Formatter } = require('./src/formatter')
const { createFileReaderStreams } = require('./src/fileReader')
const { SettingsValidator, SettingsParser } = require('./src/parseSettings')
const { handleErrors } = require('./src/errors')
const { notEmpty } = require('./src/utils')

/*
 * Main function processes the command line settings, validates them for errors
 * and then performs the pattern matching on the file streams.
 */
;(async function main() {
  const args = process.argv.slice(2)
  const settings = SettingsParser.parse(args)
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
