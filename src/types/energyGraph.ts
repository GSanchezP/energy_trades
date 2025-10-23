import { EnergyNode } from './energyNode'
import { BASE_NODE_HEIGHT, NodeDrawer } from './nodeDrawer'
import { NodeLevel, NodeLevels, NodeType } from './nodesConfig'

export class EnergyGraph {
  private LOW_AUTOBAHN = 680
  private UPPER_AUTOBAHN = 180

  public energyNodes: EnergyNode[] = []
  public dumpNode?: NodeDrawer

  public connectors: Connector[] = []

  private upperUsage: number[] = []
  private lowerUsage: number[] = []

  private verticalUsage: number[][] = []

  constructor(nodes: EnergyNode[]) {
    this.energyNodes = nodes
    this.computeNodePositions()
    this.addDumpNode()
    this.generateFlowConnectors()
  }

  get upperUsageLevel(): number {
    return this.upperUsage.reduce((a, b) => a + b, 0)
  }

  get lowerUsageLevel(): number {
    return this.lowerUsage.reduce((a, b) => a + b, 0)
  }

  get nodes(): NodeDrawer[] {
    return this.dumpNode ? [...this.energyNodes, this.dumpNode] : [...this.energyNodes]
  }

  get graphEroi(): number {
    return (
      this.energyNodes
        .filter((node) => node.level.id === 'tertiary')
        .reduce((a, b) => a + b.inputPower, 0) /
      this.energyNodes
        .filter((node) => node.level.id === 'extraction')
        .reduce((a, b) => a + b.inputPower, 0)
    )
  }

  addDumpNode() {
    const x1 = Math.min(...this.energyNodes.map((n) => n.x))
    const x2 = Math.max(...this.energyNodes.map((n) => n.x + n.width + 120))
    const dumpNode = new NodeDrawer('heat', 'dump', '#e04c4cff', { width: x2 - x1, height: 100 })
    dumpNode.setPosition = { x: x1, y: 850 }
    this.dumpNode = dumpNode
  }

  computeNodePositions() {
    const numNodesPerLevel = NodeLevels.reduce(
      (acc, curr) => {
        acc[curr] = 0
        return acc
      },
      {} as Record<NodeLevel, number>
    )
    for (const node of this.energyNodes) {
      node.setPosition = {
        x: 100 + (node.level.value - 1) * 300,
        y: 200 + numNodesPerLevel[node.level.id] * 200
      }
      numNodesPerLevel[node.level.id] += 1
    }

    this.LOW_AUTOBAHN = (Math.max(...Object.values(numNodesPerLevel)) + 1) * 200
  }

  generateFlowConnectors() {
    this.lowerUsage = []
    this.upperUsage = []

    for (const sourceNode of this.energyNodes) {
      for (const [targetId, power] of Object.entries(sourceNode.outputMap) as [
        NodeType,
        number
      ][]) {
        const targetNode = this.energyNodes.find((node) => node.id === targetId)
        if (targetNode && targetNode.id !== sourceNode.id) {
          this.connectors.push(this.createConnector(sourceNode, targetNode, power))
        }
      }
      this.connectors.push(this.createDumpConnector(sourceNode))
    }
  }

  createDumpConnector(source: EnergyNode): Connector {
    let sourceOffset = source.outputPower * BASE_NODE_HEIGHT

    // Calculate stroke width based on power (min 0, max 100)
    const strokeWidth = source.losses * BASE_NODE_HEIGHT

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
      power: source.losses,
      strokeWidth,
      color: '#e04c4cff'
    }
  }

  private createConnector(source: EnergyNode, target: EnergyNode, power: number): Connector {
    let sourceOffset = 0
    for (const [key, value] of Object.entries(source.outputMap)) {
      if (key === target.id) break
      sourceOffset += value * BASE_NODE_HEIGHT
    }

    let targetOffset = 0
    for (const [key, value] of Object.entries(target.inputMap)) {
      if (key === source.id) break
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

    const sourceLevel = source.level.value
    const targetLevel = target.level.value

    let yAutobahn
    if (targetLevel - sourceLevel === 1) {
      yAutobahn = sourceY
    } else if (sourceLevel < targetLevel) {
      yAutobahn = this.LOW_AUTOBAHN + this.lowerUsageLevel + strokeWidth / 2
      this.lowerUsage.push(strokeWidth)
    } else {
      yAutobahn = this.UPPER_AUTOBAHN - this.upperUsageLevel - strokeWidth / 2
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
