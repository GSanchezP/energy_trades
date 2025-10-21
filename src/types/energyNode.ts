export type NodeType =
  | 'Petroleum'
  | 'Coal'
  | 'Mining'
  | 'Fuels'
  | 'Electricity'
  | 'Manufacture'
  | 'Food'
  | 'Transport'
  | 'WellBeing'
  | 'Leisure'
  | 'Heat'

export type NodeWeights = { [key in NodeType]: number }

export const BASE_NODE_HEIGHT = 160

export enum NodeLevel {
  Dump = 0,
  Primary = 1,
  Conversion = 2,
  Industrial = 3,
  Societal = 4,
  Target = 5
}

export function outputMap(outputMap?: { [key in NodeType]?: number }): NodeWeights {
  let total = 0

  if (outputMap) {
    for (const val of Object.values(outputMap)) {
      total += val
    }
  }

  return {
    Petroleum: outputMap?.Petroleum ?? 0,
    Coal: outputMap?.Coal ?? 0,
    Mining: outputMap?.Mining ?? 0,
    Fuels: outputMap?.Fuels ?? 0,
    Electricity: outputMap?.Electricity ?? 0,
    Manufacture: outputMap?.Manufacture ?? 0,
    Food: outputMap?.Food ?? 0,
    Transport: outputMap?.Transport ?? 0,
    WellBeing: outputMap?.WellBeing ?? 0,
    Leisure: outputMap?.Leisure ?? 0,
    Heat: 1 - total
  }
}

export interface Position {
  x: number
  y: number
}

export class BasicNode {
  private _nodeLevel: NodeLevel = NodeLevel.Primary
  private _position: Position = { x: 0, y: 0 }
  private _size: { height: number; width: number }
  private _color: string = '#ffffff'

  constructor(nodeLevel: NodeLevel, color: string, size?: { height: number; width: number }) {
    this._nodeLevel = nodeLevel
    this._color = color
    this._size = size ?? { height: BASE_NODE_HEIGHT, width: 120 }
  }

  get id() {
    return 'Heat'
  }

  get nodeLevel(): NodeLevel {
    return this._nodeLevel
  }

  get color(): string {
    return this._color
  }

  set setPosition(pos: Position) {
    this._position = pos
  }

  get x() {
    return this._position.x
  }

  get y() {
    return this._position.y
  }

  set setSize(size: { height: number; width: number }) {
    this._size = size
  }

  get width() {
    return this._size.width
  }

  get height() {
    return this._size.height
  }
}

export class EnergyNode extends BasicNode {
  private _nodeType: NodeType

  private _treDependencies: NodeWeights // Amount of energy to produce 1 watt
  private _inputMap: NodeWeights
  private _outputMap: NodeWeights // which percentage of the produced energy goes into the other nodes,
  private _inputPower: number
  private _outputPower: number
  private _losses: number
  private _eroi: number
  private _limitingFactor: number

  constructor(
    nodeLevel: NodeLevel,
    nodeType: NodeType,
    treDependencies: NodeWeights, // Amount of energy to produce 1 watt
    inputMap: NodeWeights,
    outputMap: NodeWeights, // which percentage of the produced energy goes into the other nodes,
    color: string
  ) {
    super(nodeLevel, color)
    this._nodeType = nodeType
    this._treDependencies = treDependencies
    this._inputMap = inputMap
    this._outputMap = outputMap
    this._inputPower = Object.values(this.inputMap).reduce((acc, curr) => acc + curr)
    this._outputPower = Object.values(this.outputMap).reduce((acc, curr) => acc + curr)
    this._losses = Math.max(this._inputPower - this.outputPower, 0)
    this._eroi = this._outputPower / (this._inputPower + Number.MIN_VALUE)

    this._limitingFactor = this.calculateLimitingFactor()
    this.setSize = {
      width: this.width,
      height: BASE_NODE_HEIGHT * Math.max(this._inputPower, this._outputPower)
    }
  }

  get id() {
    return this._nodeType
  }

  get nodeType() {
    return this._nodeType
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

  limitingFactor(nodeType: NodeType) {
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

  private checkOutputMap() {
    const add = Object.values(this.outputMap).reduce((acc, curr) => {
      return acc + curr
    })
    if (add < 0.99 || add > 1.01) {
      throw new Error(`Output Map for ${this.nodeType} does not add 1 (${add})`)
    }
  }
}
