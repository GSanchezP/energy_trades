import nodesJson from './nodes.json'

export const NodeTypes = [
  'petroleum',
  'coal',
  'sun',
  'mining',
  'fuels',
  'thermal_electricity',
  'renewable_electricity',
  'electricity',
  'food',
  'thermal_transport',
  'electric_transport',
  'transport',
  'heavy_thermal_transport',
  'heavy_electric_transport',
  'heavy_transport',
  'thermal_heating',
  'electric_heating',
  'heating',
  'basicNeeds',
  'humanLabor',
  'leisure',
  'freeTime',
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

/** JSON factor entry: plain number (legacy) or value + citation comment. */
export type FactorEntryJson = number | { value: number; comment?: string }

export type FactorMapJson = Partial<Record<NodeType, FactorEntryJson>>

export function isFactorEntryObject(
  value: unknown
): value is { value: number; comment?: string } {
  return typeof value === 'object' && value !== null && 'value' in value
}

/** Normalize JSON factors into numeric weights + optional comments. */
export function normalizeFactors(factors?: FactorMapJson): {
  values: Partial<Record<NodeType, number>>
  comments: Partial<Record<NodeType, string>>
} {
  const values: Partial<Record<NodeType, number>> = {}
  const comments: Partial<Record<NodeType, string>> = {}
  if (!factors) return { values, comments }

  for (const [key, entry] of Object.entries(factors)) {
    const id = key as NodeType
    if (entry === undefined || entry === null) continue
    if (isFactorEntryObject(entry)) {
      values[id] = entry.value
      if (entry.comment) comments[id] = entry.comment
    } else if (typeof entry === 'number') {
      values[id] = entry
    }
  }

  return { values, comments }
}

export class NodeConfig {
  constructor(
    readonly id: NodeType,
    readonly label: string,
    readonly level: NodeLevel,
    readonly color: string,
    readonly _factors?: Partial<Record<NodeType, number>>,
    readonly _addons?: Partial<Record<NodeType, number | null>>,
    /** Bare-minimum net output required for feasibility (optional). */
    readonly minOutput?: number,
    /** When true, this node's net output counts toward the CO₂ aggregate. */
    readonly co2?: boolean,
    /**
     * End-use sink: skip T:node = Σ inbound flows.
     * Needed when nothing consumes this node (otherwise an empty sum forces T = 0).
     */
    readonly endUse?: boolean,
    /**
     * Residual / complement node: T:id = 1 − Σ T:residualOf, with T:id ≥ 0.
     * Drawn with no connectors; sized from its own T value.
     */
    readonly residualOf?: NodeType[],
    /** Optional citations / notes for each factor value. */
    readonly _factorComments?: Partial<Record<NodeType, string>>
  ) {}

  get netOutputVar() {
    return `T:${this.id}`
  }

  /** True when this node is a time/budget residual with no energy flows. */
  get isResidual(): boolean {
    return (this.residualOf?.length ?? 0) > 0
  }

  public inputFactorVarName(inputNodeId: NodeType) {
    return `f:${inputNodeId}:${this.id}`
  }

  get factors(): Partial<Record<NodeType, number>> {
    return this._factors ?? {}
  }

  get factorComments(): Partial<Record<NodeType, string>> {
    return this._factorComments ?? {}
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
  /** Visual column groups with separator titles (between dump and heat excluded). */
  levelBands: LevelBandConfig[]
}

export interface LevelBandConfig {
  id: string
  label: string
  levels: NodeLevel[]
}

export interface LevelBandConfigJson {
  id: string
  label: string
  levels: NodeLevel[]
}

/** Nested addon definition embedded under a sum node in JSON. */
export interface AddonConfigJson {
  weight: number | null
  label: string
  factors?: FactorMapJson
}

export interface NodeConfigJson {
  id: NodeType
  label: string
  level: NodeLevel
  color: string
  factors?: FactorMapJson
  /** Nested addon objects, or legacy flat weight map. */
  addons?: Partial<Record<NodeType, AddonConfigJson | number | null>>
  /** Bare-minimum net output required for feasibility. */
  minOutput?: number
  /** When true, this node's net output counts toward the CO₂ aggregate. */
  co2?: boolean
  /**
   * End-use sink: do not tie net output to the sum of inbound consumer flows.
   * Use for nodes nothing else consumes (e.g. leisure, basic needs).
   */
  endUse?: boolean
  /**
   * Residual node: T = 1 − Σ listed nodes (each ≥ 0). No energy connectors.
   */
  residualOf?: NodeType[]
}

function isAddonConfig(value: unknown): value is AddonConfigJson {
  return typeof value === 'object' && value !== null && 'weight' in value && 'label' in value
}

/** Non-extraction nodes with factors must sum those factors to ≥ 1. */
export function getFactorSumFailures(nodes: NodeConfig[]): string[] {
  const failures: string[] = []

  for (const node of nodes) {
    if (node.level === 'extraction') continue

    const factorValues = Object.values(node.factors)
    if (factorValues.length === 0) continue

    const sum = factorValues.reduce((acc, v) => acc + v, 0)
    if (sum < 1 - 1e-9) {
      failures.push(`"${node.id}" (factors sum to ${sum.toFixed(4)}, need ≥ 1)`)
    }
  }

  return failures
}

/** @throws if any non-extraction factor node sums to less than 1. */
export function assertFactorSumsAtLeastOne(nodes: NodeConfig[]) {
  const failures = getFactorSumFailures(nodes)
  if (failures.length > 0) {
    throw new Error(
      `Invalid factor totals — each non-extraction factor node must sum to at least 1:\n- ${failures.join('\n- ')}`
    )
  }
}

function nodeFromJsonParts(
  id: NodeType,
  label: string,
  level: NodeLevel,
  color: string,
  factorsJson: FactorMapJson | undefined,
  addons: Partial<Record<NodeType, number | null>> | undefined,
  minOutput?: number,
  co2?: boolean,
  endUse?: boolean,
  residualOf?: NodeType[]
) {
  const { values, comments } = normalizeFactors(factorsJson)
  return new NodeConfig(
    id,
    label,
    level,
    color,
    values,
    addons,
    minOutput,
    co2,
    endUse,
    residualOf,
    comments
  )
}

/** Expand sum nodes so each nested addon becomes its own NodeConfig. */
export function expandNodesFromJson(jsonNodes: NodeConfigJson[]): NodeConfig[] {
  const result: NodeConfig[] = []

  for (const n of jsonNodes) {
    if (!n.addons || Object.keys(n.addons).length === 0) {
      result.push(
        nodeFromJsonParts(
          n.id,
          n.label,
          n.level,
          n.color,
          n.factors,
          undefined,
          n.minOutput,
          n.co2,
          n.endUse,
          n.residualOf
        )
      )
      continue
    }

    const weightMap: Partial<Record<NodeType, number | null>> = {}

    for (const [addonId, addon] of Object.entries(n.addons)) {
      const id = addonId as NodeType
      if (isAddonConfig(addon)) {
        weightMap[id] = addon.weight
        // Addon nodes inherit the sum node's level and color (not co2/min).
        result.push(nodeFromJsonParts(id, addon.label, n.level, n.color, addon.factors, undefined))
      } else {
        weightMap[id] = addon as number | null
      }
    }

    result.push(
      nodeFromJsonParts(
        n.id,
        n.label,
        n.level,
        n.color,
        n.factors,
        weightMap,
        n.minOutput,
        n.co2,
        n.endUse,
        n.residualOf
      )
    )
  }

  return result
}

export const nodesConfig: NodesConfig = {
  nodes: expandNodesFromJson(nodesJson.nodes as NodeConfigJson[]),
  levelBands: (nodesJson as { levelBands?: LevelBandConfigJson[] }).levelBands ?? []
}
