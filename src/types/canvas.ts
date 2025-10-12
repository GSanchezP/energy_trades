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

export enum NodeLevel {
  Dump = 0,
  Primary = 1,
  Conversion = 2,
  Industrial = 3,
  Societal = 4
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

export class EnergyGraph {
  public energyNodes: EnergyNode[] = []
  public dumpNode?: BasicNode

  get nodes(): BasicNode[] {
    return this.dumpNode ? [...this.energyNodes, this.dumpNode] : [...this.energyNodes]
  }

  push(node: EnergyNode) {
    node.position = this.computePos(node.nodeLevel)
    this.energyNodes.push(node)
  }

  addDumpNode() {
    const x1 = Math.min(...this.energyNodes.map((n) => n.x))
    const x2 = Math.max(...this.energyNodes.map((n) => n.x + n.width + 120))
    const dumpNode = new BasicNode(NodeLevel.Dump, '#e04c4cff', { width: x2 - x1, height: 100 })
    dumpNode.position = { x: x1, y: 850 }
    this.dumpNode = dumpNode
  }

  calculate() {
    console.log('calculating')
    for (const calcNode of this.energyNodes) {
      calcNode.calculateOutput()
      for (const node of this.energyNodes) {
        console.log(
          `Input of [${node.nodeType}][${calcNode.nodeType}] when from ${node.input[calcNode.nodeType].toFixed(2)} to ${calcNode.output[node.nodeType].toFixed(2)}`
        )
        node.input[calcNode.nodeType] = calcNode.output[node.nodeType]
      }
    }
  }

  private computePos(nodeLevel: NodeLevel) {
    return {
      x: 100 + (nodeLevel - 1) * 400,
      y: 200 + this.energyNodes.filter((en) => en.nodeLevel === nodeLevel).length * 200
    }
  }

  generateFlowConnectors(): Connector[] {
    const connectors: Connector[] = []

    for (const sourceNode of this.energyNodes) {
      for (const [targetType, power] of Object.entries(sourceNode.output) as [NodeType, number][]) {
        if (targetType === 'Heat') {
          connectors.push(this.createDumpConnector(sourceNode, power))
        }

        const targetNode = this.energyNodes.find((node) => node.nodeType === targetType)
        if (targetNode && targetNode.id !== sourceNode.id) {
          if (targetNode.nodeLevel > sourceNode.nodeLevel) {
            console.log(
              `Computing forward from ${sourceNode.nodeType} to ${targetNode.nodeType} with ${power}`
            )
            connectors.push(this.createConnector(sourceNode, targetNode, power, 'forward'))
          } else {
            console.log(
              `Computing backward from ${sourceNode.nodeType} to ${targetNode.nodeType} with ${power}`
            )
            connectors.push(this.createConnector(sourceNode, targetNode, power, 'backward'))
          }
        }
      }
    }

    return connectors
  }

  createDumpConnector(source: EnergyNode, power: number): Connector {
    let sourceOffset = 0
    for (const [key, value] of Object.entries(source.output)) {
      if (key === 'Heat') break
      sourceOffset += value * 100 // * source.outputPower // TODO
    }

    // Calculate stroke width based on power (min 0, max 100)
    const strokeWidth = power * 100

    let xOffset = 10 + strokeWidth / 2

    const sourceX = source.x + source.width
    const sourceY = source.y + sourceOffset + strokeWidth / 2

    let points: number[]

    // Flow goes to lower level - exit from top of source

    points = [
      sourceX,
      sourceY, // Start at top center of source

      sourceX + xOffset + sourceOffset,
      sourceY, // Go to the left

      sourceX + xOffset + sourceOffset,
      900
    ]

    return {
      id: `${source.id}-dump`,
      from: source.id,
      to: 'Dump',
      points,
      power,
      strokeWidth,
      color: '#e04c4cff'
    }
  }

  private createConnector(
    source: EnergyNode,
    target: EnergyNode,
    power: number,
    type: 'backward' | 'forward'
  ): Connector {
    const LOW_AUTOBAHN = 600
    const UPPER_AUTOBAHN = 100

    let sourceOffset = 0
    for (const [key, value] of Object.entries(source.output)) {
      if (key === target.nodeType) break
      sourceOffset += value * 100 // * source.outputPower // TODO
    }

    let targetOffset = 0
    for (const [key, value] of Object.entries(target.input)) {
      if (key === source.nodeType) break
      targetOffset += value * 100 // source.inputPower
    }

    // Calculate stroke width based on power (min 0, max 100)
    const strokeWidth = power * 100

    let xOffset = 10 + strokeWidth / 2

    const sourceX = source.x + source.width
    const sourceY = source.y + sourceOffset + strokeWidth / 2
    const targetX = target.x
    const targetY = target.y + targetOffset + strokeWidth / 2

    let points: number[]

    // Flow goes to lower level - exit from top of source

    if (type === 'forward') {
      points = [
        sourceX,
        sourceY, // Start at top center of source

        sourceX + xOffset + sourceOffset,
        sourceY, // Go to the left

        sourceX + xOffset + sourceOffset,
        LOW_AUTOBAHN + sourceOffset, // Go down the autobahn

        targetX - xOffset - targetOffset,
        LOW_AUTOBAHN + sourceOffset, // Go horizontally to target

        targetX - xOffset - targetOffset,
        targetY, // Go down to target center

        targetX,
        targetY // Go down to target center
      ]
    } else {
      points = [
        sourceX,
        sourceY, // Start at top center of source

        sourceX + xOffset + sourceOffset,
        sourceY, // Go to the left

        sourceX + xOffset + sourceOffset,
        UPPER_AUTOBAHN + sourceOffset, // Go down the autobahn

        targetX - xOffset - sourceOffset,
        UPPER_AUTOBAHN + sourceOffset, // Go horizontally to target

        targetX - xOffset - sourceOffset,
        targetY, // Go down to target center

        targetX,
        targetY // Go down to target center
      ]
    }

    return {
      id: `${source.id}-${target.id}`,
      from: source.id,
      to: target.id,
      points,
      power,
      strokeWidth,
      color: source.color
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
  color: string
}
