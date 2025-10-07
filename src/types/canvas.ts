type NodeType =
  | 'Petroleum'
  | 'Minerals'
  | 'Fuels'
  | 'Electricity'
  | 'Manufacture'
  | 'Transport'
  | 'WellBeing'
  | 'Leisure'

type NodeWeights = { [key in NodeType]: number }

export enum NodeLevel {
  Primary = 1,
  Conversion = 2,
  Industrial = 3,
  Societal = 4
}
export interface Position {
  x: number
  y: number
}

export class EnergyNode {
  private outputPower: number = 1
  input: NodeWeights = {
    Petroleum: 1,
    Minerals: 1,
    Fuels: 1,
    Electricity: 1,
    Manufacture: 1,
    Transport: 1,
    WellBeing: 1,
    Leisure: 1
  }
  output: NodeWeights = {
    Petroleum: 1,
    Minerals: 1,
    Fuels: 1,
    Electricity: 1,
    Manufacture: 1,
    Transport: 1,
    WellBeing: 1,
    Leisure: 1
  }
  private _position: Position = { x: 0, y: 0 }
  constructor(
    readonly nodeLevel: NodeLevel,
    readonly nodeType: NodeType,
    private readonly treDependencies: NodeWeights, // Amount of energy to produce 1 watt
    private readonly outputMap: NodeWeights // which percentage of the produced energy goes into the other nodes
  ) {
    this.checkOutputMap()
    this.calculateTre()
  }

  get id() {
    return this.nodeType
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
    return 150
  }

  get height() {
    return 200
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

export class EnergyGraph {
  public nodes: EnergyNode[] = []

  push(node: EnergyNode) {
    node.position = this.computePos(node.nodeLevel)
    this.nodes.push(node)
  }

  calculate() {
    console.log('calculating')
    for (const calcNode of this.nodes) {
      calcNode.calculateOutput()
      for (const node of this.nodes) {
        console.log(
          `Input of [${node.nodeType}][${calcNode.nodeType}] when from ${node.input[calcNode.nodeType].toFixed(2)} to ${calcNode.output[node.nodeType].toFixed(2)}`
        )
        node.input[calcNode.nodeType] = calcNode.output[node.nodeType]
      }
    }
  }

  private computePos(nodeLevel: NodeLevel) {
    return {
      x: 200 + (nodeLevel - 1) * 400,
      y: 200 + this.nodes.filter((en) => en.nodeLevel === nodeLevel).length * 350
    }
  }
}

export interface Connector {
  id: string
  from: string
  to: string
  points: number[]
}
