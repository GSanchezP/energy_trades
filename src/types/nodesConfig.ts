export interface NodeConfig {
  id: string
  acr: string
  level: string
  color: string
  inputs: Record<string, number>
}

export interface NodesConfig {
  nodes: NodeConfig[]
}

export const nodesConfig: NodesConfig = {
  nodes: [
    {
      id: 'Petroleum',
      acr: 'p',
      level: 'Primary',
      color: '#442d54ff',
      inputs: {
        WellBeing: 0.05,
        Fuels: 0.02,
        Electricity: 0.02,
        Manufacture: 0.02
      }
    },
    {
      id: 'Coal',
      acr: 'c',
      level: 'Primary',
      color: '#3d2913ff',
      inputs: {
        WellBeing: 0.05,
        Fuels: 0.02,
        Electricity: 0.02,
        Manufacture: 0.02
      }
    },
    {
      id: 'Fuels',
      acr: 'f',
      level: 'Conversion',
      color: '#610a52ff',
      inputs: {
        WellBeing: 0.05,
        Petroleum: 1.2,
        Electricity: 0.01
      }
    },
    {
      id: 'Electricity',
      acr: 'e',
      level: 'Conversion',
      color: '#0d92a3ff',
      inputs: {
        WellBeing: 0.05,
        Coal: 2.5
      }
    },
    {
      id: 'Mining',
      acr: 'm',
      level: 'Conversion',
      color: '#856350ff',
      inputs: {
        WellBeing: 0.05,
        Fuels: 1,
        Electricity: 0.25
      }
    },
    {
      id: 'Transport',
      acr: 't',
      level: 'Industrial',
      color: '#58b00aff',
      inputs: {
        WellBeing: 0.05,
        Fuels: 3
      }
    },
    {
      id: 'Food',
      acr: 'o',
      level: 'Industrial',
      color: '#b0b00aff',
      inputs: {
        WellBeing: 0.15,
        Fuels: 0.65,
        Manufacture: 0.25,
        Mining: 0.15
      }
    },
    {
      id: 'Manufacture',
      acr: 'i',
      level: 'Industrial',
      color: '#976c17ff',
      inputs: {
        WellBeing: 0.05,
        Mining: 1,
        Electricity: 1.6,
        Transport: 0.1
      }
    },
    {
      id: 'WellBeing',
      acr: 'w',
      level: 'Societal',
      color: '#1fbb65ff',
      inputs: {
        Fuels: 0.25,
        Electricity: 0.2,
        Manufacture: 0.2,
        Transport: 0.4,
        Food: 0.4
      }
    },
    {
      id: 'Leisure',
      acr: 'l',
      level: 'Target',
      color: '#c953bdff',
      inputs: {
        Fuels: 0.15,
        Electricity: 0.2,
        Manufacture: 0.2,
        Transport: 0.4,
        WellBeing: 0.6,
        Food: 0.4
      }
    }
  ]
}
