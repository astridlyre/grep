const { Transform } = require('stream')
const { notEmpty, isEmpty } = require('./utils')

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

module.exports = { Matcher }
