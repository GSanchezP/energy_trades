export type NodeType =
  | 'Petroleum'
  | 'Minerals'
  | 'Fuels'
  | 'Electricity'
  | 'Manufacture'
  | 'Transport'
  | 'WellBeing'
  | 'Leisure'
  | 'Heat'

type NodeWeights = { [key in NodeType]: number }

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
  private _position: Position = { x: 0, y: 0 }

  constructor(
    readonly nodeLevel: NodeLevel,
    readonly color: string,
    readonly size?: { height: number; width: number }
  ) {}

  get id() {
    return 'Heat'
  }

  set position(pos: Position) {
    this._position = pos
  }

  get x() {
    return this._position.x
  }

  get y() {
    return this._position.y
  }

  get width() {
    return this.size!.width
  }

  get height() {
    return this.size!.height
  }
}

export class EnergyNode extends BasicNode {
  public outputPower: number = 1
  input: NodeWeights = {
    Petroleum: 1,
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
    Minerals: 1,
    Fuels: 1,
    Electricity: 1,
    Manufacture: 1,
    Transport: 1,
    WellBeing: 1,
    Leisure: 1,
    Heat: 0
  }
  constructor(
    readonly nodeLevel: NodeLevel,
    readonly nodeType: NodeType,
    public readonly treDependencies: NodeWeights, // Amount of energy to produce 1 watt
    public readonly outputMap: NodeWeights, // which percentage of the produced energy goes into the other nodes,
    readonly color: string
  ) {
    super(nodeLevel, color)
    this.checkOutputMap()
    this.calculateTre()
  }

  get id() {
    return this.nodeType
  }

  get width() {
    return 120
  }

  get height() {
    return 100
  }

  calculateOutput() {
    let power = 1
    console.log(this.treDependencies)
    console.log(this.input)
    for (const key of Object.keys(this.input) as NodeType[]) {
      if (this.treDependencies[key] === 0) continue
      const factor =
        Math.min(this.input[key], this.treDependencies[key]) / this.treDependencies[key]
      console.log(`${key} factor: ${factor}`)
      power *= factor
    }

    power = 1 // Remove this line when working

    console.log(`Total power: ${power}`)
    this.outputPower = power

    for (const [key, val] of Object.entries(this.outputMap) as [NodeType, number][]) {
      this.output[key] = this.outputPower * val
    }

    console.log(this.output)
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

    console.log(`Node ${this.nodeType} has a TRE of ${(1 / add).toFixed(2)}`)
  }
}
