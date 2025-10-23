import { EnergyNode } from './energyNode'
import { BASE_NODE_HEIGHT, NodeDrawer, nodeLevelValue, prevLevel } from './nodeDrawer'
import { NodeLevel, NodeLevels, NodeType } from './nodesConfig'

export class EnergyGraph {
  private LOW_AUTOBAHN = 680
  private UPPER_AUTOBAHN = 180

  public energyNodes: EnergyNode[] = []
  public dumpNode?: NodeDrawer

  public connectors: Connector[] = []

  private upperUsage: number[] = []
  private lowerTotalUsage: number = 0
  private lowerCurrentUsage: number = 0

  private verticalUsage: Partial<Record<NodeLevel, number>> = {}

  constructor(nodes: EnergyNode[]) {
    this.energyNodes = nodes
    this.calculateVerticalUsage()
    this.calculateLowBahnUsage()
    this.computeNodePositions()
    this.addDumpNode()
    this.generateFlowConnectors()
  }

  get upperUsageLevel(): number {
    return this.upperUsage.reduce((a, b) => a + b, 0)
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

  calculateLowBahnUsage() {
    this.lowerTotalUsage = 0
    for (const node of this.energyNodes) {
      // Add low output
      for (const [targetNodeId, value] of Object.entries(node.outputMap)) {
        if (!value) continue
        const targetNode = this.energyNodes.find((n) => n.id === targetNodeId)
        if (!targetNode) continue
        if (this.levelComparer(node, targetNode) === 'above') {
          this.lowerTotalUsage += value
        }
      }
    }
  }

  calculateVerticalUsage() {
    const calculate = (dir: 'low' | 'high') => {
      const verticalUsage: Partial<Record<NodeLevel, number>> = {}
      const nodeDir = dir === 'low' ? 'above' : 'below'
      for (const level of NodeLevels) {
        const nodes = this.energyNodes.filter((n) => n.level.id === level)

        for (const node of nodes) {
          // Add low output
          for (const [targetNodeId, value] of Object.entries(node.outputMap)) {
            if (!value) continue
            const targetNode = this.energyNodes.find((n) => n.id === targetNodeId)
            if (!targetNode) continue
            const relation = this.levelComparer(node, targetNode)
            if (relation === nodeDir) {
              verticalUsage[level] = verticalUsage[level] ? verticalUsage[level] + value : value
            }
          }

          // Add low input
          for (const [sourceNodeId, value] of Object.entries(node.inputMap)) {
            if (!value) continue
            const sourceNode = this.energyNodes.find((n) => n.id === sourceNodeId)
            if (!sourceNode) continue
            const relation = this.levelComparer(sourceNode, node)
            const prevLevel = NodeLevels[nodeLevelValue(level) - 1]
            if (relation === nodeDir) {
              verticalUsage[prevLevel] = verticalUsage[prevLevel]
                ? verticalUsage[prevLevel] + value
                : value
            }
          }

          if (dir === 'low') {
            // Add losses
            verticalUsage[level]! = verticalUsage[level]
              ? verticalUsage[level] + node.losses
              : node.losses
          }
        }
      }

      return verticalUsage
    }

    const lowUsage = calculate('low')
    const highUsage = calculate('high')

    for (const level of NodeLevels) {
      this.verticalUsage[level] = Math.max(lowUsage[level] ?? 0, highUsage[level] ?? 0)
    }
  }

  addDumpNode() {
    const x1 = Math.min(...this.energyNodes.map((n) => n.x))
    const x2 = Math.max(...this.energyNodes.map((n) => n.x + n.width + 120))
    const dumpNode = new NodeDrawer('heat', 'dump', '#e04c4cff', { width: x2 - x1, height: 100 })
    dumpNode.setPosition = { x: x1, y: 850 }
    this.dumpNode = dumpNode
  }

  computeNodePositions() {
    let maxLevel = 0
    let xOffset = 0
    for (const level of NodeLevels) {
      if (nodeLevelValue(level)) {
        const value = (this.verticalUsage[prevLevel(level)] ?? 0) * BASE_NODE_HEIGHT
        xOffset += value
      }

      let i = 0
      for (const node of this.energyNodes.filter((n) => n.level.id === level)) {
        node.setPosition = {
          x: 100 + (node.level.value - 1) * 200 + xOffset,
          y: 200 + i * 200
        }
        i++
      }
      maxLevel = Math.max(maxLevel, i)
    }

    this.LOW_AUTOBAHN = (maxLevel + 1) * 200
  }

  generateFlowConnectors() {
    this.upperUsage = []

    for (const level of NodeLevels) {
      // Starting from below
      let xOffset = 0
      for (const node of this.energyNodes.filter((n) => n.level.id === level).reverse()) {
        const dumpConnector = this.createDumpConnector(node, xOffset)
        xOffset += dumpConnector.strokeWidth
        this.connectors.push(dumpConnector)
        for (const [targetNodeId, power] of Object.entries(node.outputMap).reverse()) {
          const targetNode = this.energyNodes.find((node) => node.id === targetNodeId)
          if (!targetNode || !power) continue
          if (this.levelComparer(node, targetNode) === 'above') {
            const connector = this.createBelowConnector(node, targetNode, power, xOffset)
            xOffset += connector.strokeWidth
            this.connectors.push(connector)
          }
        }
      }
    }

    for (const sourceNode of this.energyNodes) {
      for (const [targetId, power] of Object.entries(sourceNode.outputMap) as [
        NodeType,
        number
      ][]) {
        const targetNode = this.energyNodes.find((node) => node.id === targetId)
        if (targetNode && targetNode.id !== sourceNode.id) {
          const conn = this.createConnector(sourceNode, targetNode, power)
          if (conn) this.connectors.push(conn)
        }
      }
    }
  }

  private createBelowConnector(
    source: EnergyNode,
    target: EnergyNode,
    power: number,
    xOffset: number
  ): Connector {
    let sourceYOffset = 0
    for (const [key, value] of Object.entries(source.outputMap)) {
      if (key === target.id) break
      sourceYOffset += value * BASE_NODE_HEIGHT
    }

    let targetYOffset = 0
    for (const [key, value] of Object.entries(target.inputMap)) {
      if (key === source.id) break
      targetYOffset += value * BASE_NODE_HEIGHT
    }

    // Calculate stroke width based on power (min 0, max 100)
    const strokeWidth = power * BASE_NODE_HEIGHT

    let sourceXOffset = 10 + xOffset + strokeWidth / 2

    const sourceX = source.x + source.width
    const sourceY = source.y + sourceYOffset + strokeWidth / 2
    const targetX = target.x
    const targetY = target.y + targetYOffset + strokeWidth / 2

    let points: number[]

    // Flow goes to lower level - exit from top of source

    let yAutobahn =
      this.LOW_AUTOBAHN +
      this.lowerTotalUsage * BASE_NODE_HEIGHT -
      strokeWidth / 2 -
      this.lowerCurrentUsage

    this.lowerCurrentUsage += strokeWidth

    points = [
      sourceX,
      sourceY, // Start at top center of source

      sourceX + sourceXOffset,
      sourceY, // Go to the left

      sourceX + sourceXOffset,
      yAutobahn, // Go down the autobahn

      targetX - targetYOffset,
      yAutobahn, // Go horizontally to target

      targetX - targetYOffset,
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

  private createConnector(
    source: EnergyNode,
    target: EnergyNode,
    power: number
  ): Connector | undefined {
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

    const levelRelation = this.levelComparer(source, target)

    let yAutobahn
    if (levelRelation === 'next') {
      yAutobahn = sourceY
    } else if (levelRelation === 'above') {
      return undefined
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

  createDumpConnector(source: EnergyNode, offset: number): Connector {
    let sourceOffset = source.outputPower * BASE_NODE_HEIGHT

    // Calculate stroke width based on power (min 0, max 100)
    const strokeWidth = source.losses * BASE_NODE_HEIGHT

    let xOffset = offset + 10 + strokeWidth / 2

    const sourceX = source.x + source.width
    const sourceY = source.y + sourceOffset + strokeWidth / 2

    let points: number[]

    // Flow goes to lower level - exit from top of source

    points = [
      sourceX,
      sourceY, // Start at top center of source

      sourceX + xOffset,
      sourceY, // Go to the left

      sourceX + xOffset,
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

  private levelComparer(sourceNode: EnergyNode, targetNode: EnergyNode) {
    const sourceLevel = sourceNode.level.value
    const targetLevel = targetNode.level.value
    if (targetLevel - sourceLevel === 1) {
      return 'next'
    } else if (sourceLevel < targetLevel) {
      return 'above'
    } else {
      return 'below'
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
