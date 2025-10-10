import { EnergyGraph, EnergyNode, inputTre, NodeLevel, outputMap } from './canvas'

const energyGraph = new EnergyGraph()

energyGraph.push(
  new EnergyNode(
    NodeLevel.Primary,
    'Petroleum',
    inputTre({
      Fuels: 0.002,
      Electricity: 0.01,
      Manufacture: 0.015,
      Transport: 0.006,
      WellBeing: 0.002
    }),
    outputMap({
      Fuels: 0.3,
      Manufacture: 0.3
    }),
    '#442d54ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Primary,
    'Minerals',
    inputTre({
      Fuels: 0.01,
      Electricity: 0.05,
      Manufacture: 0.03,
      Transport: 0.02,
      WellBeing: 0.02
    }),
    outputMap({
      Manufacture: 0.5
    }),
    '#856350ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Conversion,
    'Fuels',
    inputTre({
      Petroleum: 1.5,
      Fuels: 0.02,
      Electricity: 0.03,
      Manufacture: 0.02,
      Transport: 0.006,
      WellBeing: 0.01
    }),
    outputMap({
      Petroleum: 0.002,
      Minerals: 0.01,
      Fuels: 0.02,
      Electricity: 0.3,
      Manufacture: 0.02,
      Transport: 0.08,
      WellBeing: 0.02,
      Leisure: 0.4
    }),
    '#610a52ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Conversion,
    'Electricity',
    inputTre({
      Fuels: 3,
      Electricity: 0.01,
      Manufacture: 0.025,
      Transport: 0.001,
      WellBeing: 0.007
    }),
    outputMap({
      Petroleum: 0.01,
      Minerals: 0.05,
      Fuels: 0.03,
      Electricity: 0.01,
      Manufacture: 0.3,
      WellBeing: 0.2,
      Leisure: 0.2
    }),
    '#0d92a3ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Industrial,
    'Manufacture',
    inputTre({
      Petroleum: 1.5,
      Minerals: 1.6,
      Fuels: 0.02,
      Electricity: 0.04,
      Manufacture: 0.01,
      Transport: 0.008,
      WellBeing: 0.05
    }),
    outputMap({
      Petroleum: 0.015,
      Minerals: 0.03,
      Fuels: 0.02,
      Electricity: 0.025,
      Manufacture: 0.01,
      Transport: 0.03,
      WellBeing: 0.2,
      Leisure: 0.3
    }),
    '#c2cd1dff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Industrial,
    'Transport',
    inputTre({
      Fuels: 3,
      Manufacture: 0.03,
      WellBeing: 0.03
    }),
    outputMap({
      Petroleum: 0.006,
      Minerals: 0.02,
      Fuels: 0.006,
      Electricity: 0.001,
      Manufacture: 0.008,
      WellBeing: 0.2,
      Leisure: 0.4
    }),
    '#6abf1fff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Societal,
    'WellBeing',
    inputTre({
      Fuels: 0.15,
      Electricity: 0.2,
      Manufacture: 0.2,
      Transport: 0.4,
      WellBeing: 0.6
    }),
    outputMap({
      Petroleum: 0.002,
      Minerals: 0.02,
      Fuels: 0.01,
      Electricity: 0.007,
      Manufacture: 0.05,
      Transport: 0.03,
      WellBeing: 0.6,
      Leisure: 0.2
    }),
    '#1fbb65ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Societal,
    'Leisure',
    inputTre({
      Fuels: 0.15,
      Electricity: 0.2,
      Manufacture: 0.2,
      Transport: 0.4,
      WellBeing: 0.6
    }),
    outputMap({}),
    '#c953bdff'
  )
)

energyGraph.calculate()
energyGraph.addDumpNode()

export default energyGraph
