export const NodeTypes = [
  'petroleum',
  'coal',
  'mining',
  'fuels',
  'thermal_electricity',
  'renewable_electricity',
  'electricity',
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
  'primary',
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
    readonly _addons?: Partial<Record<NodeType, number | null>>
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

  get addons(): Partial<Record<NodeType, number | null>> {
    return this._addons ?? {}
  }

  get inputs(): Partial<Record<NodeType, number | null>> {
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
        mining: 0.02
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
        mining: 0.02
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
      label: 'Thermal',
      level: 'conversion',
      color: '#0d92a3ff',
      factors: {
        wellBeing: 0.05,
        coal: 2.5
      }
    },
    {
      id: 'renewable_electricity',
      label: 'Renewable',
      level: 'conversion',
      color: '#0d92a3ff',
      factors: {
        wellBeing: 0.1,
        mining: 0.15
      }
    },
    {
      id: 'electricity',
      label: 'Elec',
      level: 'conversion',
      color: '#0d92a3ff',
      addons: {
        thermal_electricity: null,
        renewable_electricity: 0.2
      }
    },
    {
      id: 'mining',
      label: 'Mining &\nManufacturing',
      level: 'primary',
      color: '#856350ff',
      factors: {
        wellBeing: 0.1,
        fuels: 2,
        electricity: 1,
        transport: 0.1
      }
    },
    {
      id: 'food',
      label: 'Food',
      level: 'primary',
      color: '#b0b00aff',
      factors: {
        wellBeing: 0.15,
        fuels: 2.5,
        mining: 0.4
      }
    },
    {
      id: 'thermal_transport',
      label: 'Thermal',
      level: 'primary',
      color: '#58b00aff',
      factors: {
        wellBeing: 0.05,
        fuels: 3,
        mining: 0.15
      }
    },
    {
      id: 'electric_transport',
      label: 'Electric',
      level: 'primary',
      color: '#58b00aff',
      factors: {
        wellBeing: 0.05,
        electricity: 1.3,
        mining: 0.25
      }
    },
    {
      id: 'transport',
      label: 'Transp',
      level: 'primary',
      color: '#58b00aff',
      addons: {
        thermal_transport: 0.5,
        electric_transport: null
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
        mining: 0.2,
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
        mining: 0.2,
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
