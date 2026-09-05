import { BASE_NODE_HEIGHT, NodeDrawer } from './nodeDrawer'
import { NodeLevel, NodeType, NodeWeights } from './nodesConfig'

export class EnergyNode extends NodeDrawer {
  private _eroiFactors: NodeWeights // Amount of energy to produce 1 watt
  private _eroiAddons: Partial<Record<NodeType, number | null>>
  private _inputMap: NodeWeights
  private _outputMap: NodeWeights // which percentage of the produced energy goes into the other nodes,
  private _inputPower: number
  private _outputPower: number
  private _losses: number
  private _eroi: number
  /** Residual / complement nodes have no energy connectors. */
  private _isolated: boolean

  constructor(
    label: string,
    nodeLevel: NodeLevel,
    nodeLevelPosition: number,
    nodeType: NodeType,
    eroiFactors: NodeWeights, // Amount of energy to produce 1 watt
    eroiAddons: Partial<Record<NodeType, number | null>>,
    inputMap: NodeWeights,
    outputMap: NodeWeights, // which percentage of the produced energy goes into the other nodes,
    color: string,
    options?: { isolated?: boolean; displayPower?: number }
  ) {
    const inputPower = Object.values(inputMap).reduce((acc, curr) => acc + curr)
    const outputPower = Object.values(outputMap).reduce((acc, curr) => acc + curr)
    const displayPower = options?.displayPower
    const sizePower =
      displayPower !== undefined ? displayPower : Math.max(inputPower, outputPower)
    super(
      nodeType,
      nodeLevel,
      nodeLevelPosition,
      color,
      {
        height: BASE_NODE_HEIGHT * sizePower
      },
      label
    )
    this._eroiFactors = eroiFactors
    this._eroiAddons = eroiAddons
    this._inputMap = inputMap
    this._outputMap = outputMap
    this._inputPower = displayPower !== undefined ? displayPower : inputPower
    this._outputPower = displayPower !== undefined ? displayPower : outputPower
    this._losses = Math.max(this._inputPower - this.outputPower, 0)
    this._eroi = this._outputPower / (this._inputPower + Number.MIN_VALUE)
    this._isolated = options?.isolated ?? false
  }

  /** True when this node aggregates other nodes via addons (e.g. Electricity, Transport). */
  get isSumNode(): boolean {
    return Object.keys(this._eroiAddons).length > 0
  }

  get isIsolated(): boolean {
    return this._isolated
  }

  get addonIds(): NodeType[] {
    return Object.keys(this._eroiAddons) as NodeType[]
  }

  get inputPower() {
    return this._inputPower
  }

  get outputPower() {
    return this._outputPower
  }

  get losses() {
    return this._losses
  }

  get eroi() {
    return this._eroi
  }

  get eroiFactors() {
    return this._eroiFactors
  }

  get eroiAddons() {
    return this._eroiAddons
  }

  get inputMap() {
    return this._inputMap
  }

  get outputMap() {
    return this._outputMap
  }
}
