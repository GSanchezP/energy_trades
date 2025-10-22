export const NodeTypes = [
  'petroleum',
  'coal',
  'mining',
  'fuels',
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

export enum NodeLevel {
  Dump = 0,
  Extraction = 1,
  Conversion = 2,
  Primary = 3,
  Industrial = 4,
  Tertiary = 5
}

export interface NodeConfig {
  id: NodeType
  label: string
  level: string
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
      label: 'p',
      level: 'Extraction',
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
      label: 'c',
      level: 'Extraction',
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
      label: 'f',
      level: 'Conversion',
      color: '#610a52ff',
      inputs: {
        wellBeing: 0.05,
        petroleum: 1.2,
        electricity: 0.01
      }
    },
    {
      id: 'electricity',
      label: 'e',
      level: 'Conversion',
      color: '#0d92a3ff',
      inputs: {
        wellBeing: 0.05,
        coal: 2.5
      }
    },
    {
      id: 'mining',
      label: 'm',
      level: 'Primary',
      color: '#856350ff',
      inputs: {
        wellBeing: 0.05,
        fuels: 1,
        electricity: 0.25
      }
    },
    {
      id: 'food',
      label: 'o',
      level: 'Primary',
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
      label: 't',
      level: 'Industrial',
      color: '#58b00aff',
      inputs: {
        wellBeing: 0.05,
        fuels: 3,
        manufacture: 0.15
      }
    },
    {
      id: 'manufacture',
      label: 'i',
      level: 'Industrial',
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
      label: 'w',
      level: 'Tertiary',
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
      label: 'l',
      level: 'Tertiary',
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
