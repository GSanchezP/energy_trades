import { BASE_NODE_HEIGHT, NodeDrawer } from './nodeDrawer'
import { NodeLevel, NodeType, NodeWeights } from './nodesConfig'

export class EnergyNode extends NodeDrawer {
  private _label: string
  private _treDependencies: NodeWeights // Amount of energy to produce 1 watt
  private _inputMap: NodeWeights
  private _outputMap: NodeWeights // which percentage of the produced energy goes into the other nodes,
  private _inputPower: number
  private _outputPower: number
  private _losses: number
  private _eroi: number
  private _limitingFactor: number

  constructor(
    label: string,
    nodeLevel: NodeLevel,
    nodeLevelPosition: number,
    nodeType: NodeType,
    treDependencies: NodeWeights, // Amount of energy to produce 1 watt
    inputMap: NodeWeights,
    outputMap: NodeWeights, // which percentage of the produced energy goes into the other nodes,
    color: string
  ) {
    const inputPower = Object.values(inputMap).reduce((acc, curr) => acc + curr)
    const outputPower = Object.values(outputMap).reduce((acc, curr) => acc + curr)
    super(nodeType, nodeLevel, nodeLevelPosition, color, {
      height: BASE_NODE_HEIGHT * Math.max(inputPower, outputPower)
    })
    this._label = label
    this._treDependencies = treDependencies
    this._inputMap = inputMap
    this._outputMap = outputMap
    this._inputPower = inputPower
    this._outputPower = outputPower
    this._losses = Math.max(this._inputPower - this.outputPower, 0)
    this._eroi = this._outputPower / (this._inputPower + Number.MIN_VALUE)

    this._limitingFactor = this.calculateLimitingFactor()
  }

  get label() {
    return this._label
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

  get treDependencies() {
    return this._treDependencies
  }

  get inputMap() {
    return this._inputMap
  }

  get outputMap() {
    return this._outputMap
  }

  inputRelativeUsage(nodeType: NodeType) {
    return (
      (this.inputMap[nodeType] || 0) / (this.treDependencies[nodeType] || 0) / this._limitingFactor
    )
  }

  private calculateLimitingFactor() {
    let limitingFactor = 1
    for (const [nodeType, value] of Object.entries(this.inputMap)) {
      if (this._treDependencies[nodeType as NodeType] > 0) {
        limitingFactor = Math.min(
          limitingFactor,
          value / this._treDependencies[nodeType as NodeType]
        )
      }
    }
    return limitingFactor
  }
}
