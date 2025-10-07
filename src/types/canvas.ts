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
      y: 300 + this.nodes.filter((en) => en.nodeLevel === nodeLevel).length * 350
    }
  }

  generateFlowConnectors(): Connector[] {
    const connectors: Connector[] = []

    for (const sourceNode of this.nodes) {
      for (const [targetType, power] of Object.entries(sourceNode.output) as [NodeType, number][]) {
        const targetNode = this.nodes.find((node) => node.nodeType === targetType)
        if (targetNode && targetNode.id !== sourceNode.id) {
          if (targetNode.nodeLevel > sourceNode.nodeLevel) {
            const connector = this.createLowerConnector(sourceNode, targetNode, power)
            connectors.push(connector)
          }
        }
      }
    }

    return connectors
  }

  private createLowerConnector(source: EnergyNode, target: EnergyNode, power: number): Connector {
    const sourceX = source.x + source.width / 2
    const sourceY = source.y + source.height / 2
    const targetX = target.x + target.width / 2
    const targetY = target.y + target.height / 2

    let points: number[]

    // Flow goes to lower level - exit from top of source

    // Calculate stroke width based on power (min 0, max 100)
    const strokeWidth = power * 100

    const lineW = 100 + strokeWidth / 2

    points = [
      sourceX,
      sourceY, // Start at top center of source

      sourceX + lineW,
      sourceY, // Go to the left

      sourceX + lineW,
      950, // Go down the autobahn

      targetX - lineW,
      950, // Go horizontally to target

      targetX - lineW,
      targetY, // Go down to target center

      targetX,
      targetY // Go down to target center
    ]

    return {
      id: `${source.id}-${target.id}`,
      from: source.id,
      to: target.id,
      points,
      power,
      strokeWidth
    }
  }
}

export interface Connector {
  id: string
  from: string
  to: string
  points: number[]
  power: number
  strokeWidth: number
}
