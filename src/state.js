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

module.exports = { State }
