'use strict'
// vim: set ts=2 sw=2 expandtab:
const reactExpressMiddleware = require('react-express-middleware')
const _createStore = require('@wesleytodd/state-container')

module.exports = function reactExpressMiddlewareWithStateContainer (Component, opts = {}) {
  // Default options
  const handleErrors = opts.handleErrors || false
  const dispatchKey = opts.dispatchKey || '$dispatch'
  const subscribeKey = opts.subscribeKey || '$subscribe'
  const routeChangeAction = opts.routeChangeAction || '$routeChange'
  const createStore = opts.createStore || _createStore
  const noHydrate = opts.noHydrate || false

  function mw (err, req, res, next) {
    let store

    const o = Object.assign({}, opts, {
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
        store = createStore(options.Component.reducer || options.reducer || (state => state), res.locals)

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
            // @TODO error handling once the first render occurs?
            if (err) debugger // eslint-disable-line
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
    })

    // Create a reactExpressMiddleware
    const renderMW = noHydrate ? reactExpressMiddleware.render(Component, o) : reactExpressMiddleware(Component, o)

    // Call the middleware
    ;(handleErrors) ? renderMW(err, req, res, next) : renderMW(req, res, next)
  }

  return handleErrors ? mw : (req, res, next) => mw(null, req, res, next)
}
