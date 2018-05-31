/* eslint-disable no-unused-expressions */
'use strict'

// Imports {{{

const pickBy_ = require('lodash/pickBy')
const Type = require('union-type')

// }}}

// Helpers {{{

const every = fn => array => array.every(fn)

// }}}

/* We'll create the basics of a connect panel, dealing with:
 *
 * 1. Initialising the app
 * 2. Selecting a Dataset
 * 3. Addind/removing bindings
 */

/* What if we were to create Redux Actions as ADTs?
 * 
 * We would be able to create a reducer that uses pattern matching instead of a switch case. But
 * what else?
 * 
 * If we were to define an action using ADT we would also be able to type check the values it is
 * created with.
 * 
 * So let's define some basic type we would later be able to use in our Action ADTs for validation:
 * 
 * - Collection Field
 * - Component Property
 * - Dataset
 */

const Field = Type({
  Field: { name: String, type: String }
})

const Prop = Type({
  Prop: { name: String, types: Array }
})

/* A dataset needs to validate an array of fields, lets define a little helper */

const isArrayOfFields = every(
  Field.prototype.isPrototypeOf.bind(Field.prototype)
)

const Dataset = Type({
  Dataset: { name: String, controllerRef: Object, fields: isArrayOfFields }
})

/* Actions!
 * 
 * We will define the following actions:
 * 
 * - InitApp: with component properties and available datasets
 * - SelectDataset: the name of the chose one
 * - ClearDataset: revert any previous selection
 * - BindProp: bind a prop to a field
 * - ClearProp: clear a property binding
 */

const isArrayOfProps = every(Prop.prototype.isPrototypeOf.bind(Prop.prototype))

const isArrayOfDatasets = every(
  Dataset.prototype.isPrototypeOf.bind(Dataset.prototype)
)

const actions = Type({
  InitApp: { props: isArrayOfProps, datasets: isArrayOfDatasets },
  SelectDataset: { dataset: String },
  ClearDataset: [],
  BindProp: { prop: String, field: String },
  ClearProp: { prop: String }
})

/* Ok. So we have some actions with validations.
 * 
 * What's next?
 * 
 * Let's see what the reducer would look like.
 */

const patternMatchingReducder = (state, action) =>
  action.case({
    InitApp: (props, datasets) =>
      Object.assign({}, state, {
        componentProperties: props,
        availableDatasets: datasets.map(({ name }) => name),
        datasetFields: datasets.reduce(
          (acc, value) =>
            Object.assign({}, acc, { [value.name]: value.fields }),
          {}
        )
      }),
    SelectDataset: dataset =>
      Object.assign({}, state, {
        selectedDataset: dataset
      }),
    ClearDataset: () => {},
    BindProp: () => {},
    ClearProp: () => {}
  })

/* Let's test it. We'll need some actions to throw at it. */

const prop = Prop.PropOf({ name: 'value', types: ['Text', 'Number'] })

const titleField = Field.FieldOf({ name: 'title', type: 'Text' })
const priceField = Field.FieldOf({ name: 'price', type: 'Number' })

const datasetA = Dataset.DatasetOf({
  name: 'Catalog',
  controllerRef: { type: 'something', id: 'somesuch' },
  fields: [titleField, priceField]
})

const invoiceNumberField = Field.FieldOf({
  name: 'invoiceNumber',
  type: 'Number'
})
const totalAmountField = Field.FieldOf({ name: 'totalAmount', type: 'Number' })
const emailField = Field.FieldOf({ name: 'email', type: 'Text' })

const datasetB = Dataset.DatasetOf({
  name: 'Purchases',
  controllerRef: { type: 'somethingElse', id: 'somesuchOther' },
  fields: [invoiceNumberField, totalAmountField, emailField]
})

const initAppAction = actions.InitAppOf({
  props: [prop],
  datasets: [datasetA, datasetB]
})

const selectDatasetAction = actions.SelectDatasetOf({
  dataset: 'Catalog'
})

/* and an initial state to work with */
const initialState = {
  componentProperties: [],
  availableDatasets: [],
  datasetFields: {},
  selectedDataset: null,
  bindings: {}
}

const initialisedAppState = patternMatchingReducder(initialState, initAppAction)
initialisedAppState.componentProperties.map(({ name }) => name)
initialisedAppState.availableDatasets
Object.keys(initialisedAppState.datasetFields)
initialisedAppState.datasetFields.Catalog.map(({ name }) => name)

const selectedDatasetState = patternMatchingReducder(
  initialisedAppState,
  selectDatasetAction
)
selectedDatasetState.selectedDataset

/* Awesome!
 * 
 * Can we take it a step further?
 * 
 * One of the side-effect of using Serial Effects is that we have more actions to deal with. There
 * are actions that convey the results of side-effects, there are actions that implement state
 * machines within the reducer (see the viewer app's save process).
 * 
 * Many times, however, not all actions can be sensibly dispatched at any given time. For example,
 * most Dataset API methods are not available during the save process. Binding a property in the
 * connect panel is not possible before a dataset was selected.
 * 
 * Can model these different "modes" of the application as an ADT???
 */

/* We'll begin with some helpers for validating each Mode instance */

// App Mode helpers {{{

const isEmptyArray = array => Array.isArray(array) && array.length === 0
const isNonEmptyArray = array => Array.isArray(array) && array.length > 0
const isEmptyObject = obj => Object.keys(obj).length === 0
const isNonEmptyObject = obj => Object.keys(obj).length > 0
const isNil = a => a === null
const isNonNil = a => a !== null

// }}}

/* And now, the AppModes ADT */

const AppModes = Type({
  Init: {
    componentProperties: isEmptyArray,
    availableDatasets: isEmptyArray,
    datasetFields: isEmptyObject,
    selectedDataset: isNil,
    bindings: isEmptyObject
  },
  DatasetSelection: {
    componentProperties: isNonEmptyArray,
    availableDatasets: isNonEmptyArray,
    datasetFields: isNonEmptyObject,
    selectedDataset: isNil,
    bindings: isEmptyObject
  },
  BindingSelection: {
    componentProperties: isNonEmptyArray,
    availableDatasets: isNonEmptyArray,
    datasetFields: isNonEmptyObject,
    selectedDataset: isNonNil,
    bindings: () => true
  }
})

// Conversions {{{

const firstMapped = (fn, array) => {
  return array.reduce((acc, value) => {
    if (acc.length === 0) {
      const mappedValue = fn(value)
      if (mappedValue) {
        return acc.concat(mappedValue)
      }
    }
    return acc
  }, [])
}

AppModes.appModeOf = state => {
  const availableModes = Object.keys(AppModes).filter(key => key.endsWith('Of'))
  const firstMatchingMode = firstMapped(modeCreator => {
    try {
      return AppModes[modeCreator](state)
    } catch (e) {
      return false
    }
  }, availableModes)

  if (firstMatchingMode.length === 0) {
    throw Error('invalid state')
  }

  return firstMatchingMode[0]
}

AppModes.stateOf = mode => {
  return pickBy_(mode, (value, key) =>
    [
      'componentProperties',
      'availableDatasets',
      'datasetFields',
      'selectedDataset',
      'bindings'
    ].includes(key)
  )
}

// }}}

// Mode Reducers {{{

const initModeReducer = (state, action) => () => {
  return action.case({
    InitApp: (props, datasets) =>
      Object.assign({}, state, {
        componentProperties: props,
        availableDatasets: datasets.map(({ name }) => name),
        datasetFields: datasets.reduce(
          (acc, value) =>
            Object.assign({}, acc, { [value.name]: value.fields }),
          {}
        )
      }),
    _: () => {
      throw Error('bad state for action')
    }
  })
}

const selectDatasetReducer = (state, action) => () => {
  return action.case({
    SelectDataset: dataset =>
      Object.assign({}, state, {
        selectedDataset: dataset
      }),
    _: () => {
      throw Error('bad state for action', action)
    }
  })
}

// }}}

// Reducer method {{{

AppModes.prototype.reduce = function reduce(action) {
  const state = AppModes.stateOf(this)
  return this.case({
    Init: initModeReducer(state, action),
    DatasetSelection: selectDatasetReducer(state, action),
    BindingSelection: () => {}
  })
}

// }}}

const reducer = (state, action) => {
  return AppModes.appModeOf(state).reduce(action)
}

const stateAfterInit = reducer(initialState, initAppAction)
stateAfterInit.componentProperties.map(({ name }) => name)
stateAfterInit.availableDatasets
Object.keys(stateAfterInit.datasetFields)

reducer(initialState, selectDatasetAction)

const stateWithSelectedDataset = reducer(stateAfterInit, selectDatasetAction)

stateWithSelectedDataset.selectedDataset
