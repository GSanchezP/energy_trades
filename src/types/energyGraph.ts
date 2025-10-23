import { EnergyNode } from './energyNode'
import { BASE_NODE_HEIGHT, NodeDrawer, nodeLevelValue, prevLevel } from './nodeDrawer'
import { NodeLevel, NodeLevels } from './nodesConfig'

type ConnectorType = 'above' | 'below' | 'middle'

export class EnergyGraph {
  private LOW_AUTOBAHN = 680
  private UPPER_AUTOBAHN = 180

  public energyNodes: EnergyNode[] = []
  public dumpNode?: NodeDrawer

  public connectors: Connector[] = []

  private upperUsage: number[] = []
  private lowerTotalUsage: number = 0
  private lowerCurrentUsage: number = 0
  private upperCurrentUsage: number = 0

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
        if (this.levelComparer(node, targetNode) === 'greater') {
          this.lowerTotalUsage += value
        }
      }
    }
  }

  calculateVerticalUsage() {
    const calculate = (dir: 'low' | 'high') => {
      const verticalUsage: Partial<Record<NodeLevel, number>> = {}
      const nodeDir: LevelComparerResult = dir === 'low' ? 'smaller' : 'greater'
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

    let xSourceOffsetMap: Partial<Record<NodeLevel, number>> = {}
    const xTargetOffsetMap: Partial<Record<NodeLevel, number>> = {}

    const iterations: Array<{
      addDump: boolean
      reverse: boolean
      levelComparer: LevelComparerResult
      connectorType: ConnectorType
    }> = [
      { addDump: true, reverse: true, levelComparer: 'smaller', connectorType: 'below' },
      { addDump: false, reverse: false, levelComparer: 'greater', connectorType: 'above' },
      { addDump: false, reverse: false, levelComparer: 'next', connectorType: 'middle' }
    ]

    for (const i of iterations) {
      function r<T>(arr: Array<T>, r: boolean) {
        if (r) return arr.reverse()
        return arr
      }
      // Reset from above
      xSourceOffsetMap = {}
      for (const level of NodeLevels) {
        // Starting from below
        if (!xSourceOffsetMap[level]) {
          xSourceOffsetMap[level] = 0
        }
        for (const node of r(
          this.energyNodes.filter((n) => n.level.id === level),
          i.reverse
        )) {
          if (i.addDump) {
            const dumpConnector = this.createDumpConnector(node, xSourceOffsetMap[level])
            xSourceOffsetMap[node.level.id]! += dumpConnector.strokeWidth
            this.connectors.push(dumpConnector)
          }

          for (const [targetNodeId, power] of r(Object.entries(node.outputMap), i.reverse)) {
            const targetNode = this.energyNodes.find((node) => node.id === targetNodeId)
            if (!targetNode || !power) continue
            if (this.levelComparer(node, targetNode) === i.levelComparer) {
              const connector = this.createConnector(
                node,
                targetNode,
                power,
                xSourceOffsetMap,
                xTargetOffsetMap,
                i.connectorType
              )
              this.connectors.push(connector)
            }
          }
        }
      }
    }
  }

  private calculateYOffset(node: EnergyNode, targetId: string, isInput: boolean): number {
    const map = isInput ? node.inputMap : node.outputMap
    let offset = 0
    for (const [key, value] of Object.entries(map)) {
      if (key === targetId) break
      offset += value * BASE_NODE_HEIGHT
    }
    return offset
  }

  private calculateAutobahnY(direction: 'above' | 'below', strokeWidth: number): number {
    const baseAutobahn = direction === 'below' ? this.LOW_AUTOBAHN : this.UPPER_AUTOBAHN
    const curr = direction === 'below' ? this.lowerCurrentUsage : this.upperCurrentUsage
    const total = direction === 'below' ? this.lowerTotalUsage : 0
    if (direction === 'below') {
      // Update usage tracking
      this.lowerCurrentUsage += strokeWidth
    } else {
      // Update usage tracking
      this.upperCurrentUsage += strokeWidth
    }
    return baseAutobahn + total * BASE_NODE_HEIGHT - strokeWidth / 2 - curr
  }

  private createConnector(
    source: EnergyNode,
    target: EnergyNode,
    power: number,
    xSourceOffsetMap: Partial<Record<NodeLevel, number>>,
    xTargetOffsetMap: Partial<Record<NodeLevel, number>>,
    connectorType: ConnectorType
  ): Connector {
    const strokeWidth = power * BASE_NODE_HEIGHT

    // Initialize target offset map if needed
    if (!xTargetOffsetMap[target.level.id]) {
      xTargetOffsetMap[target.level.id] = 0
    }

    // Calculate offsets
    const sourceYOffset = this.calculateYOffset(source, target.id, false)
    const targetYOffset = this.calculateYOffset(target, source.id, true)
    const targetXOffset = (xTargetOffsetMap[target.level.id]! ?? 0) + strokeWidth

    // Calculate X offsets based on direction
    let sourceXOffset = 10 + (xSourceOffsetMap[source.level.id]! ?? 0) + strokeWidth / 2

    // Update offset maps
    xTargetOffsetMap[target.level.id]! = targetXOffset
    if (connectorType !== 'middle') {
      xSourceOffsetMap[source.level.id]! += strokeWidth
    }

    // Calculate positions
    const sourceX = source.x + source.width
    const sourceY = source.y + sourceYOffset + strokeWidth / 2
    const targetX = target.x
    const targetY = target.y + strokeWidth / 2 + targetYOffset

    // Calculate autobahn Y based on direction
    let yAutobahn: number
    if (connectorType === 'middle') {
      yAutobahn = sourceY // Direct horizontal connection
    } else {
      yAutobahn = this.calculateAutobahnY(connectorType, strokeWidth)
    }

    // Calculate points based on direction
    const horizontalX =
      connectorType === 'middle'
        ? Math.max(sourceX + sourceXOffset, targetX - targetXOffset + strokeWidth / 2 - 10)
        : targetX - targetXOffset + strokeWidth / 2 - 10

    let points = [
      sourceX,
      sourceY, // Start at source
      sourceX + sourceXOffset,
      sourceY, // Go right
      sourceX + sourceXOffset,
      yAutobahn, // Go down to autobahn
      horizontalX,
      yAutobahn, // Go horizontally to target
      horizontalX,
      targetY, // Go down to target
      targetX,
      targetY // Final position
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

  private levelComparer(sourceNode: EnergyNode, targetNode: EnergyNode): LevelComparerResult {
    const sourceLevel = sourceNode.level.value
    const targetLevel = targetNode.level.value
    if (targetLevel - sourceLevel === 1) {
      return 'next'
    } else if (sourceLevel < targetLevel) {
      return 'smaller'
    } else {
      return 'greater'
    }
  }
}

export type LevelComparerResult = 'next' | 'smaller' | 'greater'

export interface Connector {
  id: string
  from: string
  to: string
  points: number[]
  power: number
  strokeWidth: number
  color: string
}
