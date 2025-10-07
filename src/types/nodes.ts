import { EnergyGraph, EnergyNode, NodeLevel } from './canvas'

const energyGraph = new EnergyGraph()

energyGraph.push(
  new EnergyNode(
    NodeLevel.Primary,
    'Petroleum',
    {
      Petroleum: 0,
      Minerals: 0,
      Fuels: 0.002,
      Electricity: 0.01,
      Manufacture: 0.015,
      Transport: 0.006,
      WellBeing: 0.002,
      Leisure: 0
    },
    {
      Petroleum: 0,
      Minerals: 0,
      Fuels: 0.5,
      Electricity: 0.5,
      Manufacture: 0,
      Transport: 0,
      WellBeing: 0,
      Leisure: 0
    }
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Primary,
    'Minerals',
    {
      Petroleum: 0,
      Minerals: 0,
      Fuels: 0.01,
      Electricity: 0.05,
      Manufacture: 0.03,
      Transport: 0.02,
      WellBeing: 0.02,
      Leisure: 0
    },
    {
      Petroleum: 0,
      Minerals: 0,
      Fuels: 0,
      Electricity: 0,
      Manufacture: 1,
      Transport: 0,
      WellBeing: 0,
      Leisure: 0
    }
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Conversion,
    'Fuels',
    {
      Petroleum: 1.5,
      Minerals: 0,
      Fuels: 0.02,
      Electricity: 0.03,
      Manufacture: 0.02,
      Transport: 0.006,
      WellBeing: 0.01,
      Leisure: 0
    },
    {
      Petroleum: 0.002,
      Minerals: 0.01,
      Fuels: 0.02,
      Electricity: 0.3,
      Manufacture: 0.02,
      Transport: 0.08,
      WellBeing: 0.02,
      Leisure: 0.548
    }
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Conversion,
    'Electricity',
    {
      Petroleum: 0,
      Minerals: 0,
      Fuels: 3,
      Electricity: 0.01,
      Manufacture: 0.025,
      Transport: 0.001,
      WellBeing: 0.007,
      Leisure: 0
    },
    {
      Petroleum: 0.01,
      Minerals: 0.05,
      Fuels: 0.03,
      Electricity: 0.01,
      Manufacture: 0.04,
      Transport: 0,
      WellBeing: 0.2,
      Leisure: 0.66
    }
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Industrial,
    'Manufacture',
    {
      Petroleum: 1.5,
      Minerals: 1.6,
      Fuels: 0.02,
      Electricity: 0.04,
      Manufacture: 0.01,
      Transport: 0.008,
      WellBeing: 0.05,
      Leisure: 0
    },
    {
      Petroleum: 0.015,
      Minerals: 0.03,
      Fuels: 0.02,
      Electricity: 0.025,
      Manufacture: 0.01,
      Transport: 0.03,
      WellBeing: 0.2,
      Leisure: 0.67
    }
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Industrial,
    'Transport',
    {
      Petroleum: 0,
      Minerals: 0,
      Fuels: 3,
      Electricity: 0,
      Manufacture: 0.03,
      Transport: 0,
      WellBeing: 0.03,
      Leisure: 0
    },
    {
      Petroleum: 0.006,
      Minerals: 0.02,
      Fuels: 0.006,
      Electricity: 0.001,
      Manufacture: 0.008,
      Transport: 0,
      WellBeing: 0.4,
      Leisure: 0.559
    }
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Societal,
    'WellBeing',
    {
      Petroleum: 0,
      Minerals: 0,
      Fuels: 0.15,
      Electricity: 0.2,
      Manufacture: 0.2,
      Transport: 0.4,
      WellBeing: 0.6,
      Leisure: 0
    },
    {
      Petroleum: 0.002,
      Minerals: 0.02,
      Fuels: 0.01,
      Electricity: 0.007,
      Manufacture: 0.05,
      Transport: 0.03,
      WellBeing: 0.6,
      Leisure: 0.281
    }
  )
)

energyGraph.push(
  new EnergyNode(
    NodeLevel.Societal,
    'Leisure',
    {
      Petroleum: 0,
      Minerals: 0,
      Fuels: 0.15,
      Electricity: 0.2,
      Manufacture: 0.2,
      Transport: 0.4,
      WellBeing: 0.6,
      Leisure: 0
    },
    {
      Petroleum: 0.002,
      Minerals: 0.02,
      Fuels: 0.01,
      Electricity: 0.007,
      Manufacture: 0.05,
      Transport: 0.03,
      WellBeing: 0.6,
      Leisure: 0.281
    }
  )
)

energyGraph.calculate()

export default energyGraph
