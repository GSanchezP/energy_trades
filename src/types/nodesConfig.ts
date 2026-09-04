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

/** Nested addon definition embedded under a sum node in JSON. */
export interface AddonConfigJson {
  weight: number | null
  label: string
  factors?: Partial<Record<NodeType, number>>
}

export interface NodeConfigJson {
  id: NodeType
  label: string
  level: NodeLevel
  color: string
  factors?: Partial<Record<NodeType, number>>
  /** Nested addon objects, or legacy flat weight map. */
  addons?: Partial<Record<NodeType, AddonConfigJson | number | null>>
}

function isAddonConfig(value: unknown): value is AddonConfigJson {
  return typeof value === 'object' && value !== null && 'weight' in value && 'label' in value
}

/** Expand sum nodes so each nested addon becomes its own NodeConfig. */
export function expandNodesFromJson(jsonNodes: NodeConfigJson[]): NodeConfig[] {
  const result: NodeConfig[] = []

  for (const n of jsonNodes) {
    if (!n.addons || Object.keys(n.addons).length === 0) {
      result.push(new NodeConfig(n.id, n.label, n.level, n.color, n.factors))
      continue
    }

    const weightMap: Partial<Record<NodeType, number | null>> = {}
    let hasNested = false

    for (const [addonId, addon] of Object.entries(n.addons)) {
      const id = addonId as NodeType
      if (isAddonConfig(addon)) {
        hasNested = true
        weightMap[id] = addon.weight
        // Addon nodes inherit the sum node's level and color.
        result.push(new NodeConfig(id, addon.label, n.level, n.color, addon.factors))
      } else {
        // Legacy flat weight map: { thermal_transport: 0.5, ... }
        weightMap[id] = addon as number | null
      }
    }

    if (!hasNested) {
      // Flat addons only — addon nodes are declared separately in JSON.
      result.push(new NodeConfig(n.id, n.label, n.level, n.color, n.factors, weightMap))
      continue
    }

    result.push(new NodeConfig(n.id, n.label, n.level, n.color, n.factors, weightMap))
  }

  return result
}

export const nodesConfig: NodesConfig = {
  nodes: expandNodesFromJson(nodesJson.nodes as NodeConfigJson[])
}
