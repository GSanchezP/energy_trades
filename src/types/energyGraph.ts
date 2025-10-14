import {
  BASE_NODE_HEIGHT,
  BasicNode,
  EnergyNode,
  NodeLevel,
  NodeType,
  NodeWeights
} from './energyNode'

export class EnergyGraph {
  public energyNodes: EnergyNode[] = []
  public dumpNode?: BasicNode

  private upperUsage: number[] = []
  private lowerUsage: number[] = []

  get upperUsageLevel(): number {
    return this.upperUsage.reduce((a, b) => a + b, 0)
  }

  get lowerUsageLevel(): number {
    return this.lowerUsage.reduce((a, b) => a + b, 0)
  }

  get nodes(): BasicNode[] {
    return this.dumpNode ? [...this.energyNodes, this.dumpNode] : [...this.energyNodes]
  }

  setNodesOutputDependency() {
    for (const node of this.energyNodes) {
      const outputDependency = this.energyNodes.reduce(
        (acc: NodeWeights, curr: EnergyNode) => {
          acc[curr.nodeType] = curr.treDependencies[node.nodeType]
          return acc
        },
        {
          Petroleum: 0,
          Coal: 0,
          Minerals: 0,
          Fuels: 0,
          Electricity: 0,
          Manufacture: 0,
          Transport: 0,
          WellBeing: 0,
          Leisure: 0,
          Heat: 0
        }
      )
      node.setOutputDependency(outputDependency)
    }
  }

  push(node: EnergyNode) {
    node.setPosition = this.computePos(node.nodeLevel)
    this.energyNodes.push(node)
  }

  addDumpNode() {
    const x1 = Math.min(...this.energyNodes.map((n) => n.x))
    const x2 = Math.max(...this.energyNodes.map((n) => n.x + n.width + 120))
    const dumpNode = new BasicNode(NodeLevel.Dump, '#e04c4cff', { width: x2 - x1, height: 100 })
    dumpNode.setPosition = { x: x1, y: 850 }
    this.dumpNode = dumpNode
  }

  calculate() {
    for (const calcNode of this.energyNodes) {
      calcNode.calculateOutput()
      for (const node of this.energyNodes) {
        node.input[calcNode.nodeType] = calcNode.output[node.nodeType]
        node.calculateInput()
      }
    }
  }

  resizeNodesByInput() {
    for (const node of this.energyNodes) {
      node.resizeByInput()
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
          connectors.push(this.createConnector(sourceNode, targetNode, power))
        }
      }
    }

    return connectors
  }

  createDumpConnector(source: EnergyNode, power: number): Connector {
    let sourceOffset = 0
    for (const [key, value] of Object.entries(source.output)) {
      if (key === 'Heat') break
      sourceOffset += value * source.height // TODO
    }

    // Calculate stroke width based on power (min 0, max 100)
    const strokeWidth = power * BASE_NODE_HEIGHT

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

  private createConnector(source: EnergyNode, target: EnergyNode, power: number): Connector {
    const LOW_AUTOBAHN = 680
    const UPPER_AUTOBAHN = 180

    let sourceOffset = 0
    for (const [key, value] of Object.entries(source.output)) {
      if (key === target.nodeType) break
      sourceOffset += value * BASE_NODE_HEIGHT
    }

    let targetOffset = 0
    for (const [key, value] of Object.entries(target.input)) {
      if (key === source.nodeType) break
      targetOffset += value * BASE_NODE_HEIGHT
    }

    // Calculate stroke width based on power (min 0, max 100)
    const strokeWidth = power * BASE_NODE_HEIGHT

    let xOffset = 10 + strokeWidth / 2

    const sourceX = source.x + source.width
    const sourceY = source.y + sourceOffset + strokeWidth / 2
    const targetX = target.x
    const targetY = target.y + targetOffset + strokeWidth / 2

    let points: number[]

    // Flow goes to lower level - exit from top of source

    let yAutobahn
    if (target.nodeLevel - source.nodeLevel === 1) {
      yAutobahn = sourceY
    } else if (source.nodeLevel < target.nodeLevel) {
      yAutobahn = LOW_AUTOBAHN + this.lowerUsageLevel + strokeWidth / 2
      this.lowerUsage.push(strokeWidth)
    } else {
      yAutobahn = UPPER_AUTOBAHN - this.upperUsageLevel - strokeWidth / 2
      this.upperUsage.push(strokeWidth)
    }

    points = [
      sourceX,
      sourceY, // Start at top center of source

      sourceX + xOffset + sourceOffset,
      sourceY, // Go to the left

      sourceX + xOffset + sourceOffset,
      yAutobahn, // Go down the autobahn

      targetX - xOffset - targetOffset,
      yAutobahn, // Go horizontally to target

      targetX - xOffset - targetOffset,
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
