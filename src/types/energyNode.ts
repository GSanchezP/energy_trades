export type NodeType =
  | 'Petroleum'
  | 'Coal'
  | 'Minerals'
  | 'Fuels'
  | 'Electricity'
  | 'Manufacture'
  | 'Transport'
  | 'WellBeing'
  | 'Leisure'
  | 'Heat'

type NodeWeights = { [key in NodeType]: number }

export const BASE_NODE_HEIGHT = 160

export enum NodeLevel {
  Dump = 0,
  Primary = 1,
  Conversion = 2,
  Industrial = 3,
  Societal = 4
}

export function inputTre(input: { [key in NodeType]?: number }): NodeWeights {
  return {
    Petroleum: input.Petroleum ?? 0,
    Coal: input.Coal ?? 0,
    Minerals: input.Minerals ?? 0,
    Fuels: input.Fuels ?? 0,
    Electricity: input.Electricity ?? 0,
    Manufacture: input.Manufacture ?? 0,
    Transport: input.Transport ?? 0,
    WellBeing: input.WellBeing ?? 0,
    Leisure: input.Leisure ?? 0,
    Heat: input.Heat ?? 0
  }
}

export function outputMap(outputMap: { [key in NodeType]?: number }): NodeWeights {
  let total = 0

  for (const val of Object.values(outputMap)) {
    total += val
  }

  return {
    Petroleum: outputMap.Petroleum ?? 0,
    Coal: outputMap.Coal ?? 0,
    Minerals: outputMap.Minerals ?? 0,
    Fuels: outputMap.Fuels ?? 0,
    Electricity: outputMap.Electricity ?? 0,
    Manufacture: outputMap.Manufacture ?? 0,
    Transport: outputMap.Transport ?? 0,
    WellBeing: outputMap.WellBeing ?? 0,
    Leisure: outputMap.Leisure ?? 0,
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
  inputPower: number = 1
  outputPower: number = 1
  input: NodeWeights = {
    Petroleum: 1,
    Coal: 1,
    Minerals: 1,
    Fuels: 1,
    Electricity: 1,
    Manufacture: 1,
    Transport: 1,
    WellBeing: 1,
    Leisure: 1,
    Heat: 0
  }
  output: NodeWeights = {
    Petroleum: 1,
    Coal: 1,
    Minerals: 1,
    Fuels: 1,
    Electricity: 1,
    Manufacture: 1,
    Transport: 1,
    WellBeing: 1,
    Leisure: 1,
    Heat: 0
  }
  private _nodeType: NodeType

  constructor(
    nodeLevel: NodeLevel,
    nodeType: NodeType,
    public readonly treDependencies: NodeWeights, // Amount of energy to produce 1 watt
    public readonly outputMap: NodeWeights, // which percentage of the produced energy goes into the other nodes,
    color: string
  ) {
    super(nodeLevel, color)
    this._nodeType = nodeType
    this.checkOutputMap()
    this.calculateTre()
  }

  get id() {
    return this._nodeType
  }

  get nodeType() {
    return this._nodeType
  }

  calculateOutput() {
    let outputPowerFactor = 1

    for (const [key, value] of Object.entries(this.input) as [NodeType, number][]) {
      if (this.treDependencies[key] === 0) continue
      const factor =
        Math.min(this.input[key], this.treDependencies[key]) / this.treDependencies[key]
      outputPowerFactor *= factor
    }

    this.outputPower = 0.5 + 0.5 * outputPowerFactor // TODO: fix this formula

    for (const [key, val] of Object.entries(this.outputMap) as [NodeType, number][]) {
      this.output[key] = this.outputPower * val
    }
  }

  calculateInput() {
    this.inputPower = Object.values(this.input).reduce((acc, curr) => acc + curr, 0)
  }

  resizeByInput() {
    if (this.nodeLevel === NodeLevel.Primary) return
    this.setSize = { width: this.width, height: BASE_NODE_HEIGHT * this.inputPower }
  }

  checkOutputMap() {
    const add = Object.values(this.outputMap).reduce((acc, curr) => {
      return acc + curr
    })
    if (add !== 1) {
      throw new Error(`Output Map for ${this.nodeType} does not add 1 (${add})`)
    }
  }

  calculateTre() {
    const add = Object.values(this.treDependencies).reduce((acc, curr) => {
      return acc + curr
    })
  }
}
