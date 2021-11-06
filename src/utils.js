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

module.exports = {
  curry,
  not,
  and,
  isString,
  isArray,
  join,
  startsWith,
  isTerminator,
  isEmpty,
  notEmpty,
  rest,
  includes,
  keys,
  get,
  unique,
  every,
  forEach,
  filter,
  reduce,
  demethodize,
  compose,
}
