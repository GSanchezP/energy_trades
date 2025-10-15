import { EnergyNode, NodeLevel, inputTre, outputMap } from './energyNode'

import { EnergyGraph } from './energyGraph'

const energyGraph = new EnergyGraph()

energyGraph.push(
  new EnergyNode(
    NodeLevel.Primary,
    'Petroleum',
    inputTre({
      Fuels: 0.1,
      Electricity: 0.1,
      Manufacture: 0.1
    }),
    outputMap({
      Fuels: 1
    }),
    '#442d54ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Primary,
    'Coal',
    inputTre({
      Fuels: 0.1,
      Electricity: 0.1,
      Manufacture: 0.1
    }),
    outputMap({
      Electricity: 1
    }),
    '#3d2913ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Conversion,
    'Fuels',
    inputTre({
      Petroleum: 1.2,
      Electricity: 0.01
    }),
    outputMap({
      Petroleum: 0.05,
      Coal: 0.05,
      Minerals: 0.2,
      Transport: 0.7
    }),
    '#610a52ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Conversion,
    'Electricity',
    inputTre({
      Coal: 2.5
    }),
    outputMap({
      Petroleum: 0.05,
      Coal: 0.05,
      Minerals: 0.2,
      Fuels: 0.02,
      Manufacture: 0.35,
      WellBeing: 0.1,
      Leisure: 0.2
    }),
    '#0d92a3ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Conversion,
    'Minerals',
    inputTre({
      Fuels: 0.75,
      Electricity: 0.25
    }),
    outputMap({
      Manufacture: 0.8
    }),
    '#856350ff'
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Industrial,
    'Manufacture',
    inputTre({
      Minerals: 0.2,
      Electricity: 1.6,
      Transport: 0.1
    }),
    outputMap({
      Petroleum: 0.15,
      Coal: 0.15,
      Minerals: 0.03,
      Fuels: 0.02,
      Electricity: 0.025,
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
      Coal: 0.006,
      Minerals: 0.02,
      Fuels: 0.006,
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
      Transport: 0.4
    }),
    outputMap({
      Petroleum: 0.02,
      Coal: 0.02,
      Minerals: 0.02,
      Fuels: 0.01,
      Electricity: 0.007,
      Manufacture: 0.2,
      Transport: 0.03,
      Leisure: 0.4
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

energyGraph.setNodesOutputDependency()
energyGraph.calculate()
energyGraph.calculate()
energyGraph.calculate()
energyGraph.calculate()
energyGraph.calculate()
energyGraph.calculate()
energyGraph.calculate()
energyGraph.addDumpNode()
energyGraph.resizeNodesByInput()

export default energyGraph
