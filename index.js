'use strict'
// vim: set ts=2 sw=2 expandtab:

module.exports = stateContainerMiddleware
function stateContainerMiddleware (thingToRender, opts) {
  // Default options
  const renderMiddlewareFactory = opts.renderMiddlewareFactory
  const createStore = opts.createStore
  const handleErrors = opts.handleErrors || false
  const dispatchKey = opts.dispatchKey || '$dispatch'
  const subscribeKey = opts.subscribeKey || '$subscribe'
  const routeChangeAction = opts.routeChangeAction || '$routeChange'
  const renderErrorAction = opts.renderErrorAction || '$renderError'

  // Require a renderMiddlewareFactory and createStore
  if (typeof renderMiddlewareFactory !== 'function') {
    throw new TypeError('renderMiddlewareFactory is required')
  }
  if (typeof createStore !== 'function') {
    throw new TypeError('createStore is required')
  }

  function mw (err, req, res, next) {
    // since you cannot/should not render multiple times on the server,
    // this functionality should only run on the client side, skip on the server
    if (typeof window === 'undefined') {
      return _render(opts)
    }

    let store
    return _render(Object.assign({}, opts, {
      before: (options, req, res, done) => {
        // Add dispatch & subscribe to res.locals so it is exposed to the app
        res.locals[dispatchKey] = (action) => {
          if (!store) {
            throw new Error('Cannot call dispatch until store is created')
          }
          return store.dispatch(action)
        }
        res.locals[subscribeKey] = (cb) => {
          if (!store) {
            throw new Error('Cannot call subscribe until store is created')
          }
          return store.subscribe(cb)
        }

        // Create the store
        store = createStore((thingToRender && thingToRender.reducer) || options.reducer || (state => state), res.locals)

        if (opts.before) {
          opts.before(options, req, res, done)
        } else {
          done()
        }
      },
      after: (err, render, next) => {
        // On the server side the render occured and we should just call next
        if (typeof window === 'undefined') {
          return done(err)
        }

        // Subscribe to the store for renders
        const unsub = store.subscribe((state) => {
          render(state, (err) => {
            if (err) {
              store.dispatch({
                type: renderErrorAction,
                error: unsub
              })
            }
          })
        })

        // Dispatch the route change action
        store.dispatch({
          type: routeChangeAction,
          unsubscribe: unsub,
          req: req,
          res: res
        })

        done()

        function done (err) {
          if (opts.after) {
            opts.after(err, render, next)
          } else if (err) {
            next(err)
          }
        }
      }
    }))

    function _render (o) {
      // Create a reactExpressMiddleware
      const renderMW = renderMiddlewareFactory(thingToRender, o)

      // Call the middleware
      ;(handleErrors) ? renderMW(err, req, res, next) : renderMW(req, res, next)
    }
  }

  return handleErrors ? mw : (req, res, next) => mw(null, req, res, next)
}

module.exports.createFactory = function (opts = {}) {
  const createStore = opts.createStore
  const routeChangeAction = opts.routeChangeAction || '$routeChange'

  if (typeof createStore !== 'function') {
    throw new TypeError('createStore is required')
  }

  let unsubscribe
  const o = Object.assign(opts, {
    createStore: (reducer, initialState) => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
        unsubscribe = null
      }

      // Create our new store
      const store = createStore(reducer, initialState)

      // unsubscribe on route change
      const unsub = store.subscribe((state, oldState, action) => {
        if (action.type === routeChangeAction) {
          unsubscribe = action.unsubscribe
          unsub()
        }
      })

      return store
    }
  })

  return function (toRender) {
    return stateContainerMiddleware(toRender, o)
  }
}
