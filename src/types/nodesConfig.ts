import nodesJson from './nodes.json'

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
  'thermal_heating',
  'electric_heating',
  'heating',
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

export interface NodeConfigJson {
  id: NodeType
  label: string
  level: NodeLevel
  color: string
  factors?: Partial<Record<NodeType, number>>
  addons?: Partial<Record<NodeType, number | null>>
}

export const nodesConfig: NodesConfig = {
  nodes: (nodesJson.nodes as NodeConfigJson[]).map(
    (n) => new NodeConfig(n.id, n.label, n.level, n.color, n.factors, n.addons)
  )
}
