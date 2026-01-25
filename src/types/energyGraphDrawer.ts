import { EnergyNode } from './energyNode'
import {
  BASE_NODE_HEIGHT,
  BASE_NODE_WIDTH,
  NodeDrawer,
  nodeLevelValue,
  prevLevel
} from './nodeDrawer'
import { NodeLevel, NodeLevels } from './nodesConfig'

type ConnectorType = 'above' | 'below' | 'middle'

export class EnergyGraphDrawer {
  private LOW_AUTOBAHN = 1050
  private UPPER_AUTOBAHN = 180

  private DUMP_NODE_Y = 1250

  public energyNodes: EnergyNode[] = []
  public dumpNode?: NodeDrawer

  public connectors: Connector[] = []

  private upperUsage: number[] = []
  private lowerTotalUsage: number = 0
  private lowerCurrentUsage: number
  private upperCurrentUsage: number = 0

  private verticalUsage: Record<NodeLevel, number>

  constructor(nodes: EnergyNode[]) {
    this.energyNodes = nodes
    this.verticalUsage = this.calculateVerticalUsage()
    this.lowerCurrentUsage = this.calculateLowBahnUsage()
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

  calculateLowBahnUsage(): number {
    let lowerTotalUsage = 0
    for (const node of this.energyNodes) {
      // Add low output
      for (const [targetNodeId, value] of Object.entries(node.outputMap)) {
        if (!value) continue
        const targetNode = this.energyNodes.find((n) => n.id === targetNodeId)
        if (!targetNode) continue
        if (this.levelComparer(node, targetNode).interLevel === 'above-next') {
          lowerTotalUsage += value
        }
      }
    }

    return lowerTotalUsage
  }

  calculateVerticalUsage() {
    const calculate = () => {
      const verticalUsage: Partial<Record<NodeLevel, number>> = {}
      for (const level of NodeLevels) {
        const nodes = this.energyNodes.filter((n) => n.level.id === level)

        // Add output for current level
        for (const node of nodes) {
          // Add losses
          verticalUsage[level]! = verticalUsage[level]
            ? verticalUsage[level] + node.losses
            : node.losses
          console.log(
            `[LOSSES][${level}][${level}] Adding losses ${node.losses} from ${node.id} to ${level}`
          )

          for (const [targetNodeId, value] of Object.entries(node.outputMap)) {
            if (!value) continue
            const targetNode = this.energyNodes.find((n) => n.id === targetNodeId)
            if (!targetNode) continue
            const relation = this.levelComparer(node, targetNode)

            if (relation.interLevel === 'above-next') {
              verticalUsage[level] = verticalUsage[level] ? verticalUsage[level] + value : value
              console.log(
                `[OUTPUT][${level}][${level}] Adding output ${value} from ${node.id} to ${targetNodeId}`
              )
            }
          }
          // Add input for previous level
          const prevLevel = NodeLevels[nodeLevelValue(level) - 1]
          for (const [sourceNodeId, value] of Object.entries(node.inputMap)) {
            if (!value) continue
            const sourceNode = this.energyNodes.find((n) => n.id === sourceNodeId)
            if (!sourceNode) continue
            const relation = this.levelComparer(sourceNode, node)

            if (
              ['before-previous', 'previous', 'same', 'above-next'].includes(relation.interLevel) ||
              (relation.interLevel === 'next' && relation.intraLevel !== 'same')
            ) {
              verticalUsage[prevLevel] = verticalUsage[prevLevel]
                ? verticalUsage[prevLevel] + value
                : value
              console.log(
                `[INPUT][${level}][${prevLevel}] Adding input ${value} from ${sourceNodeId} to ${node.id}. Relation: ${relation.interLevel}, ${relation.intraLevel}`
              )
            }
          }
        }
      }

      // for (const usageKey of Object.keys(verticalUsage) as NodeLevel[]) {
      //   verticalUsage[usageKey]! += 100
      // }

      return verticalUsage
    }

    const lowUsage = calculate()
    console.log(`Vertical low usages: ${JSON.stringify(lowUsage)}`)

    const verticalUsage: Record<NodeLevel, number> = {
      dump: 0,
      extraction: 0,
      conversion: 0,
      conversionSum: 0,
      primary: 0,
      industrial: 0,
      industrial_sum: 0,
      tertiary: 0
    }

    for (const level of NodeLevels) {
      verticalUsage[level] = Math.max(lowUsage[level] ?? 0)
    }

    return verticalUsage
  }

  addDumpNode() {
    const x1 = Math.min(...this.energyNodes.map((n) => n.x))
    const x2 = Math.max(...this.energyNodes.map((n) => n.x + n.width + 120))
    const dumpNode = new NodeDrawer('heat', 'dump', 0, '#e04c4cff', { width: x2 - x1, height: 100 })
    dumpNode.setPosition = { x: x1, y: this.DUMP_NODE_Y }
    this.dumpNode = dumpNode
  }

  computeNodePositions() {
    let maxLevel = 0
    let xOffset = 0
    for (const level of NodeLevels) {
      if (nodeLevelValue(level)) {
        let prevVerticalUsage = this.verticalUsage[prevLevel(level)]
        const value = (prevVerticalUsage ?? 0) * BASE_NODE_HEIGHT
        xOffset += value
      }

      let i = 0
      for (const node of this.energyNodes.filter((n) => n.level.id === level)) {
        const nodeSpacing = BASE_NODE_WIDTH * (node.level.value - 1)
        console.log(
          `[${level}][${node.id}] Node spacing: ${nodeSpacing}, xOffset: ${xOffset}, x: ${BASE_NODE_HEIGHT + nodeSpacing + xOffset}`
        )
        node.setPosition = {
          x: BASE_NODE_HEIGHT + nodeSpacing + xOffset,
          y: 200 + i * 200
        }
        i++
      }
      maxLevel = Math.max(maxLevel, i)
    }

    this.LOW_AUTOBAHN = (maxLevel + 1) * 200 + 300
  }

  generateFlowConnectors() {
    this.upperUsage = []

    let xSourceOffsetMap: Partial<Record<NodeLevel, number>> = {}
    const xTargetOffsetMap: Partial<Record<NodeLevel, number>> = {}

    const iterations: Array<{
      reverse: boolean
      levelComparer: LevelComparerResult
      connectorType: ConnectorType
    }> = [
      { reverse: true, levelComparer: 'above-next', connectorType: 'below' },
      { reverse: false, levelComparer: 'before-previous', connectorType: 'above' },
      { reverse: false, levelComparer: 'next', connectorType: 'middle' }
    ]

    let addDump = true

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
          if (addDump) {
            const dumpConnector = this.createDumpConnector(node, xSourceOffsetMap[level])
            xSourceOffsetMap[node.level.id]! += dumpConnector.strokeWidth
            this.connectors.push(dumpConnector)
          }

          for (const [targetNodeId, power] of r(Object.entries(node.outputMap), i.reverse)) {
            const targetNode = this.energyNodes.find((node) => node.id === targetNodeId)
            if (!targetNode || !power) continue
            const relation = this.levelComparer(node, targetNode).interLevel
            if (relation === i.levelComparer) {
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
      addDump = false
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
      sourceX, // Start at source
      sourceY, // Start at source
      sourceX + sourceXOffset, // Go right
      sourceY, // Go right
      sourceX + sourceXOffset, // Go vertical to autobahn
      yAutobahn, // Go vertical to autobahn
      horizontalX, // Go horizontally to target
      yAutobahn, // Go horizontally to target
      horizontalX, // Go vertical to target
      targetY, // Go vertical to target
      targetX, // Final position
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
      this.DUMP_NODE_Y
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

  private posComparer(source: number, target: number): LevelComparerResult {
    if (target - source === -1) return 'previous'
    if (target - source === 0) return 'same'
    if (target - source === 1) return 'next'
    if (target - source < 1) return 'before-previous'
    if (target - source > 1) return 'above-next'
    return 'same'
  }

  private levelComparer(
    sourceNode: EnergyNode,
    targetNode: EnergyNode
  ): { interLevel: LevelComparerResult; intraLevel: LevelComparerResult } {
    return {
      interLevel: this.posComparer(sourceNode.level.value, targetNode.level.value),
      intraLevel: this.posComparer(sourceNode.level.position, targetNode.level.position)
    }
  }
}

export type LevelComparerResult = 'before-previous' | 'previous' | 'same' | 'next' | 'above-next'

export interface Connector {
  id: string
  from: string
  to: string
  points: number[]
  power: number
  strokeWidth: number
  color: string
}
