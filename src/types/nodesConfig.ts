export const NodeTypes = [
  'petroleum',
  'coal',
  'mining',
  'fuels',
  'thermalElectricity',
  'electricity',
  'manufacture',
  'food',
  'transport',
  'wellBeing',
  'leisure',
  'heat'
] as const

export type NodeType = (typeof NodeTypes)[number]

export type NodeWeights = Record<NodeType, number>

export const NodeLevels = [
  'dump',
  'extraction',
  'conversion',
  'conversionSum',
  'primary',
  'industrial',
  'tertiary'
] as const
export type NodeLevel = (typeof NodeLevels)[number]

export interface NodeConfig {
  id: NodeType
  label: string
  level: NodeLevel
  color: string
  inputs: Partial<Record<NodeType, number>>
}

export interface NodesConfig {
  nodes: NodeConfig[]
}

export const nodesConfig: NodesConfig = {
  nodes: [
    {
      id: 'petroleum',
      label: 'Petroleum',
      level: 'extraction',
      color: '#442d54ff',
      inputs: {
        wellBeing: 0.05,
        fuels: 0.02,
        electricity: 0.02,
        manufacture: 0.02
      }
    },
    {
      id: 'coal',
      label: 'Coal',
      level: 'extraction',
      color: '#3d2913ff',
      inputs: {
        wellBeing: 0.05,
        fuels: 0.02,
        electricity: 0.02,
        manufacture: 0.02
      }
    },
    {
      id: 'fuels',
      label: 'Fuel',
      level: 'conversion',
      color: '#610a52ff',
      inputs: {
        wellBeing: 0.05,
        petroleum: 1.2,
        electricity: 0.01
      }
    },
    {
      id: 'thermalElectricity',
      label: 'Thermal Electricity',
      level: 'conversion',
      color: '#0d92a3ff',
      inputs: {
        wellBeing: 0.05,
        coal: 2.5
      }
    },
    {
      id: 'electricity',
      label: 'Electricity',
      level: 'conversionSum',
      color: '#0d92a3ff',
      inputs: {
        thermalElectricity: 1
      }
    },
    {
      id: 'mining',
      label: 'Mining',
      level: 'primary',
      color: '#856350ff',
      inputs: {
        wellBeing: 0.05,
        fuels: 1,
        electricity: 0.25
      }
    },
    {
      id: 'food',
      label: 'Food',
      level: 'primary',
      color: '#b0b00aff',
      inputs: {
        wellBeing: 0.15,
        fuels: 0.65,
        manufacture: 0.25,
        mining: 0.15
      }
    },
    {
      id: 'transport',
      label: 'Transport',
      level: 'industrial',
      color: '#58b00aff',
      inputs: {
        wellBeing: 0.05,
        fuels: 3,
        manufacture: 0.15
      }
    },
    {
      id: 'manufacture',
      label: 'Manufacture',
      level: 'industrial',
      color: '#976c17ff',
      inputs: {
        wellBeing: 0.05,
        mining: 1,
        electricity: 1.6,
        transport: 0.1
      }
    },
    {
      id: 'wellBeing',
      label: 'Well Being',
      level: 'tertiary',
      color: '#1fbb65ff',
      inputs: {
        fuels: 0.25,
        electricity: 0.2,
        manufacture: 0.2,
        transport: 0.4,
        food: 0.4
      }
    },
    {
      id: 'leisure',
      label: 'Leisure',
      level: 'tertiary',
      color: '#c953bdff',
      inputs: {
        fuels: 0.15,
        electricity: 0.2,
        manufacture: 0.2,
        transport: 0.4,
        wellBeing: 0.6,
        food: 0.4
      }
    }
  ]
}
