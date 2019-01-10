# Render React Components in Express with a Redux Like State Container

An Express style middleware for creating a "Redux style" state container and rendering
a React component with it.  This module pairs nicely (like a fine wine) with
[`react-express-middleware`](https://github.com/wesleytodd/react-express-middleware),
[`@wesleytodd/state-container`](https://github.com/wesleytodd/state-container) and,
[`nighthawk`](https://github.com/wesleytodd/nighthawk).


## Usage

```
$ npm i --save @wesleytodd/react-state-container-middleware
```

```javascript
const React = require('react');
const nighthawk = require('nighthawk');
const createStore = require('@wesleytodd/state-container');
const { render } = require('react-express-middleware');
const renderContainer = require('@wesleytodd/react-state-container-middleware');

// Nighthawk is just the express router setup for the browser with history.pushState routing
const app = nighthawk()

// A simple react counter component
class Counter extends React.Component {
  constructor (props) {
    super(props)
    this.props.$dispatch({
      type: 'setCountTo',
      // This is an example of accessing the express route params inside a component
      // This is a feature provided by `react-express-middleware` >v4.0.0`
      value: this.props.$params.countTo
    })
  }

  render () {
    return (
      <div className='counter'>
        <h1>Can you count to {this.props.countTo}?</h2>
        <h2>{this.props.count}</h2>
        <button onClick={this.increment}>Count</button>
      </div>
    )
  }

  // You can pass a reducer as a static property on
  // the react class and the middleware will use it to
  // create the state container/store.
  // Alternativly you can pass the reducer function
  // as an option when you create the middleware (below).
  static reducer (state, action) {
    state = state || {
      countTo: 3,
      count: 0
    }

    if (action.type === 'setCountTo') {
      state.countTo = action.value
    }
    if (action.type === 'increment') {
      state.count++
    }

    return state
  }

  increment = () => {
    // The prop `$dispatch` is the state container's
    // dispatch method.  Think of these props
    // in a similar way to how Redux connected
    // components work.
    this.props.$dispatch({ type: 'increment' })
  }
}

// Pass the component as the first argument to the middleware
app.get('/', renderContainer(Counter, {
  // The middleware makes no assumptions about your render method or store,
  // use Redux or another API compatible render method as you will
  renderMiddlewareFactory: render,
  createStore: createStore,
  initialState: {
    audience: 'World'
  }
}))
```

## Create a reusable middleware configuration with `createFactory`

```javascript
const { createFactory } = require('@wesleytodd/react-state-container-middleware')

const render = createFactory({
  renderMiddlewareFactory: render,
  createStore: createStore
})

// Will use the options from the shared render
app.get('/', render(Counter))

// Use the same render middlware to render on a different route
// This could be a different component but in this case reused Counter
app.get('/:countTo', render(Counter))
```

## Exposed Props

The middleware will pass a few props to your components:

- `$dispatch`: The store `dispatch` method bound to the store. Configurable via `opts.dispatchKey`
- `$subscribe`: The store `subscribe` method bound to the store. Configurable via `opts.subscribeKey`
- `$routeChange`: The name of the action to dispatch on a route change event. Configurable via `opts.routeChangeAction`
- `$renderError`: The name of the action to dispatch on a render error. Configurable via `opts.renderErrorAction`

The `$dispatch` prop is the one you will interact with most as it is how you change the application state.
Typically this would look like `this.props.$dispatch(action)` where `action` is something your store
recognizes as an action.  In Redux this is an object with a `type` property.  If you use
`@wesleytodd/state-container` this can be a `Promise`, `function`/thunk, or a plain action object.

The `$subscribe` function can be used to do custom things on all store actions, but remember that
by default the middleware will subscribe to updates and re-render the component, so you do not need
to do that on your own.

Route change and render errors simply dispatch an `action` with relevant state. If you want to
respond in your application state to these changes just do so in your reducer.

In an express application the standard method for handling an error is to use an error handling
middleware.  But because this middleware handles multiple renders it cannot make the decision to
call `next(err)` for you.  This is one thing with a `@TODO` before we `1.0.0` this.
