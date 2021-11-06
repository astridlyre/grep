const {
  and,
  compose,
  every,
  filter,
  includes,
  isArray,
  isString,
  keys,
  not,
  notEmpty,
  reduce,
  rest,
  startsWith,
} = require('./utils.js')

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
 * Functions for processing command line arguments
 */

class SettingsParser {
  static isValidArgs = str => startsWith('-', str) && includes(str, keys(VALID_OPTIONS))
  static firstNonArg = arr => arr.find(not(SettingsParser.isValidArgs))
  static restNonArgs = compose(rest, filter(not(SettingsParser.isValidArgs)))

  static addFilenames(args) {
    return settings => ({
      ...settings,
      fileNames: SettingsParser.restNonArgs(args),
    })
  }

  static addSearchPattern(args) {
    return settings => ({
      ...settings,
      pattern: SettingsParser.firstNonArg(args),
    })
  }

  static extractBaseSettings(args) {
    return reduce(
      (result, arg) => Object.assign(result, VALID_OPTIONS[arg]),
      BASE_SETTINGS,
      filter(SettingsParser.isValidArgs, args)
    )
  }

  static parse(args) {
    return compose(
      SettingsParser.addFilenames(args),
      SettingsParser.addSearchPattern(args),
      SettingsParser.extractBaseSettings
    )(args)
  }
}

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

module.exports = { SettingsParser, SettingsValidator }
