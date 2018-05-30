/* eslint-disable no-unused-expressions */
'use strict'

const pickBy_ = require('lodash/pickBy')
const Type = require('union-type')

const every = fn => array => array.every(fn)

const Field = Type({
  Field: { name: String, type: String }
})

const isArrayOfFields = every(
  Field.prototype.isPrototypeOf.bind(Field.prototype)
)

const Prop = Type({
  Prop: { name: String, types: Array }
})

const isArrayOfProps = every(Prop.prototype.isPrototypeOf.bind(Prop.prototype))

const Dataset = Type({
  Dataset: { name: String, controllerRef: Object, fields: isArrayOfFields }
})

const isArrayOfDatasets = every(
  Dataset.prototype.isPrototypeOf.bind(Dataset.prototype)
)

const actions = Type({
  InitApp: { props: isArrayOfProps, datasets: isArrayOfDatasets },
  SelectDataset: { dataset: String },
  ClearDataset: [],
  BindProp: { prop: String, field: String },
  ClearProp: []
})

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

const isEmptyArray = array => Array.isArray(array) && array.length === 0
const isNonEmptyArray = array => Array.isArray(array) && array.length > 0
const isEmptyObject = obj => Object.keys(obj).length === 0
const isNonEmptyObject = obj => Object.keys(obj).length > 0
const isNil = a => a === null
const isNonNil = a => a !== null

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

const initialState = {
  componentProperties: [],
  availableDatasets: [],
  datasetFields: {},
  selectedDataset: null,
  bindings: {}
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

AppModes.prototype.reduce = function reduce(action) {
  const state = AppModes.stateOf(this)
  return this.case({
    Init: initModeReducer(state, action),
    DatasetSelection: selectDatasetReducer(state, action),
    BindingSelection: () => {}
  })
}

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
