export const NodeTypes = [
  'petroleum',
  'coal',
  'mining',
  'fuels',
  'thermal_electricity',
  'renewable_electricity',
  'electricity',
  'manufacture',
  'food',
  'thermal_transport',
  'electric_transport',
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
  'industrial_sum',
  'tertiary'
] as const
export type NodeLevel = (typeof NodeLevels)[number]

export class NodeConfig {
  constructor(
    readonly id: NodeType,
    readonly label: string,
    readonly level: NodeLevel,
    readonly color: string,
    readonly _factors?: Partial<Record<NodeType, number>>,
    readonly _addons?: Partial<Record<NodeType, number>>
  ) {}

  get netOutputVar() {
    return `T:${this.id}`
  }

  public inputFactorVarName(inputNodeId: NodeType) {
    return `f:${inputNodeId}:${this.id}`
  }

  get factors(): Partial<Record<NodeType, number>> {
    return this._factors ?? {}
  }

  get addons(): Partial<Record<NodeType, number>> {
    return this._addons ?? {}
  }

  get inputs(): Partial<Record<NodeType, number>> {
    return { ...this.factors, ...this.addons }
  }
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
      factors: {
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
      factors: {
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
      factors: {
        wellBeing: 0.05,
        petroleum: 1.2,
        electricity: 0.01
      }
    },
    {
      id: 'thermal_electricity',
      label: 'T Electricity',
      level: 'conversion',
      color: '#0d92a3ff',
      factors: {
        wellBeing: 0.05,
        coal: 2.5
      }
    },
    {
      id: 'renewable_electricity',
      label: 'R Electricity',
      level: 'conversion',
      color: '#0d92a3ff',
      factors: {
        wellBeing: 0.1,
        manufacture: 0.2
      }
    },
    {
      id: 'electricity',
      label: 'Electricity',
      level: 'conversionSum',
      color: '#0d92a3ff',
      addons: {
        thermal_electricity: 0.5,
        renewable_electricity: 0.5
      }
    },
    {
      id: 'mining',
      label: 'Mining',
      level: 'primary',
      color: '#856350ff',
      factors: {
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
      factors: {
        wellBeing: 0.15,
        fuels: 0.65,
        manufacture: 0.25,
        mining: 0.15
      }
    },
    {
      id: 'thermal_transport',
      label: 'T Transport',
      level: 'industrial',
      color: '#58b00aff',
      factors: {
        wellBeing: 0.05,
        fuels: 3,
        manufacture: 0.15
      }
    },
    {
      id: 'electric_transport',
      label: 'E Transport',
      level: 'industrial',
      color: '#58b00aff',
      factors: {
        wellBeing: 0.05,
        electricity: 1.3,
        manufacture: 0.25
      }
    },
    {
      id: 'transport',
      label: 'Transport',
      level: 'industrial_sum',
      color: '#58b00aff',
      addons: {
        thermal_transport: 0.5,
        electric_transport: 0.5
      }
    },
    {
      id: 'manufacture',
      label: 'Manufacture',
      level: 'industrial',
      color: '#976c17ff',
      factors: {
        wellBeing: 0.05,
        mining: 1,
        electricity: 1.6,
        transport: 0.1
      }
    },
    {
      id: 'wellBeing',
      label: 'Basic Needs',
      level: 'tertiary',
      color: '#1fbb65ff',
      factors: {
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
      factors: {
        fuels: 0.15,
        electricity: 0.2,
        manufacture: 0.2,
        transport: 0.4,
        wellBeing: 0.6,
        food: 0.4
      }
    }
  ].map(
    (n) =>
      new NodeConfig(n.id as NodeType, n.label, n.level as NodeLevel, n.color, n.factors, n.addons)
  )
}
