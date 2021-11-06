const { forEach, compose, demethodize } = require('./utils')
/*
 * Error handler to print where things went ary
 */
const stringify = x => JSON.stringify(x, null, '  ')
const handleErrors = errors => {
  console.error('One or more errors have occurred:')
  forEach(compose(demethodize(console.error), stringify), errors)
  process.exit(1)
}

module.exports = { handleErrors }
