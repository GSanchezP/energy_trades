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
  private NODES_VERTICAL_SPACING: number

  private UPPER_AUTOBAHN_BASE: number
  private LOW_AUTOBAHN_BASE: number

  private DUMP_NODE_Y: number

  public energyNodes: EnergyNode[] = []
  public dumpNode: NodeDrawer

  public connectors: Connector[] = []

  private lowBahnCurrentUsage: number
  private upBahnCurrentUsage: number

  constructor(nodes: EnergyNode[]) {
    this.NODES_VERTICAL_SPACING = 8

    this.energyNodes = nodes
    const verticalUsageByLevel = this.calculateVerticalUsage()

    this.upBahnCurrentUsage = 0
    this.UPPER_AUTOBAHN_BASE = -this.NODES_VERTICAL_SPACING
    const belowBahnHeight = this.calculateLowBahnUsage() * BASE_NODE_HEIGHT
    this.lowBahnCurrentUsage = 0

    const maxNodeBottom = this.computeNodePositions(verticalUsageByLevel)

    // Stack below-autobahn lanes just under the tallest column, then the heat dump.
    this.LOW_AUTOBAHN_BASE = maxNodeBottom + this.NODES_VERTICAL_SPACING + belowBahnHeight

    this.DUMP_NODE_Y = this.LOW_AUTOBAHN_BASE + this.NODES_VERTICAL_SPACING

    this.dumpNode = this.addDumpNode()
    this.generateFlowConnectors()
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

  calculateUpBahnUsage(): number {
    let totalUsage = 0
    for (const node of this.energyNodes) {
      // Add upper output
      for (const [targetNodeId, value] of Object.entries(node.outputMap)) {
        if (!value) continue
        const targetNode = this.energyNodes.find((n) => n.id === targetNodeId)
        if (!targetNode) continue
        if (
          ['before-previous', 'previous', 'same'].includes(
            this.levelComparer(node, targetNode).interLevel
          )
        ) {
          totalUsage += value
        }
      }
    }

    console.log(`Upper total usage: ${totalUsage}`)

    return totalUsage
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

    console.log(`Lower total usage: ${lowerTotalUsage}`)

    return lowerTotalUsage
  }

  calculateVerticalUsage() {
    const calculate = () => {
      const verticalUsage: Partial<Record<NodeLevel, number>> = {}
      const verticalUsageDebug: Partial<
        Record<
          NodeLevel,
          { input: Partial<Record<NodeLevel, number>>; output: Partial<Record<NodeLevel, number>> }
        >
      > = {}
      for (const level of NodeLevels) {
        const nodes = this.energyNodes.filter((n) => n.level.id === level)

        for (const node of nodes) {
          // Add losses
          verticalUsage[level]! = verticalUsage[level]
            ? verticalUsage[level] + node.losses
            : node.losses
          console.log(
            `[LOSSES][${level}][${level}]:[${node.id}]→[${level}] Adding losses ${node.losses}`
          )

          // Add output for current level
          for (const [targetNodeId, value] of Object.entries(node.outputMap)) {
            if (!value) continue
            const targetNode = this.energyNodes.find((n) => n.id === targetNodeId)
            if (!targetNode) continue
            const relation = this.levelComparer(node, targetNode)

            if (relation.interLevel === 'above-next') {
              verticalUsage[level] = verticalUsage[level] ? verticalUsage[level] + value : value
              console.log(
                `[OUTPUT][${level}][${level}]:[${node.id}]→[${targetNodeId}] Adding output ${value}`
              )
              if (!verticalUsageDebug[level]) verticalUsageDebug[level] = { input: {}, output: {} }
              verticalUsageDebug![level]!['output']![targetNodeId as NodeLevel]! = value
            }
          }

          // Add input for previous levels
          const prevLevel = NodeLevels[nodeLevelValue(level) - 1]
          for (const [sourceNodeId, value] of Object.entries(node.inputMap)) {
            if (!value) continue
            const sourceNode = this.energyNodes.find((n) => n.id === sourceNodeId)
            if (!sourceNode) continue
            const relation = this.levelComparer(sourceNode, node)

            if (relation.interLevel === 'next' && relation.intraLevel === 'same') {
              if (
                Object.entries(sourceNode.outputMap).filter((e) => !!e[1])[0][0] === node.id &&
                Object.entries(node.inputMap).filter((e) => !!e[1])[0][0] === sourceNode.id
              ) {
                console.log(
                  `[INPUT][${level}][${prevLevel}]:[${sourceNodeId}]→[${node.id}] Next output at same levels, skipping.`
                )
                continue
              }
            }

            if (
              ['before-previous', 'previous', 'same', 'above-next'].includes(relation.interLevel) ||
              relation.interLevel === 'next'
            ) {
              verticalUsage[prevLevel] = verticalUsage[prevLevel]
                ? verticalUsage[prevLevel] + value
                : value
              console.log(
                `[INPUT][${level}][${prevLevel}]:[${sourceNodeId}]→[${node.id}] Adding input ${value}. Relation: ${relation.interLevel}, ${relation.intraLevel}`
              )
              if (!verticalUsageDebug[prevLevel])
                verticalUsageDebug[prevLevel] = { input: {}, output: {} }
              verticalUsageDebug![prevLevel]!['input']![sourceNodeId as NodeLevel]! = value
            }
          }
        }
      }

      console.log(verticalUsageDebug)

      return verticalUsage
    }

    const lowUsage = calculate()
    console.log(`Vertical low usages:`)
    console.log(lowUsage)

    const verticalUsage: Record<NodeLevel, number> = {
      dump: 0,
      extraction: 0,
      conversion: 0,
      conversionSum: 0,
      primary: 0,
      tertiary: 0
    }

    for (const level of NodeLevels) {
      verticalUsage[level] = Math.max(lowUsage[level] ?? 0)
    }

    return verticalUsage
  }

  addDumpNode(): NodeDrawer {
    const x1 = Math.min(...this.energyNodes.map((n) => n.x))
    const x2 = Math.max(...this.energyNodes.map((n) => n.x + n.width + 120))
    const dumpNode = new NodeDrawer('heat', 'dump', 0, '#e04c4cff', { width: x2 - x1, height: 100 })
    dumpNode.setPosition = { x: x1, y: this.DUMP_NODE_Y }
    return dumpNode
  }

  private gapAfterNode(node: EnergyNode, nextNode?: EnergyNode) {
    if (!nextNode) return this.NODES_VERTICAL_SPACING
    const maxGap = 40
    const fraction = 0.2
    return Math.min(
      maxGap,
      Math.max(this.NODES_VERTICAL_SPACING, fraction * Math.min(node.height, nextNode.height))
    )
  }

  computeNodePositions(verticalUsageByLevel: Record<NodeLevel, number>) {
    let maxNodeBottom = 0
    let xOffset = 0
    for (const level of NodeLevels) {
      if (nodeLevelValue(level)) {
        let prevVerticalUsage = verticalUsageByLevel[prevLevel(level)]
        const value = (prevVerticalUsage ?? 0) * BASE_NODE_HEIGHT + 30
        xOffset += value
      }

      const nodesInLevel = this.energyNodes.filter((n) => n.level.id === level)
      const previousLevel = nodeLevelValue(level) > 0 ? prevLevel(level) : undefined
      for (let i = 0; i < nodesInLevel.length; i++) {
        const node = nodesInLevel[i]
        const prevSibling = i > 0 ? nodesInLevel[i - 1] : undefined
        const nodeSpacing = BASE_NODE_WIDTH * (node.level.value - 1)
        // Align with the same-index node in the previous column when possible
        // (e.g. Coal ↔ T Electricity), without overlapping the sibling above.
        const peer = previousLevel
          ? this.energyNodes.find(
              (n) => n.level.id === previousLevel && n.level.position === node.level.position
            )
          : undefined

        let nodeY: number
        if (peer && prevSibling) {
          nodeY = Math.max(
            prevSibling.y + prevSibling.height + this.NODES_VERTICAL_SPACING,
            peer.y
          )
        } else if (peer) {
          nodeY = peer.y
        } else if (prevSibling) {
          nodeY = prevSibling.y + prevSibling.height + this.gapAfterNode(prevSibling, node)
        } else {
          nodeY = 0
        }

        console.log(
          `[${level}][${node.id}] Node spacing: ${nodeSpacing}, xOffset: ${xOffset}, x: ${BASE_NODE_HEIGHT + nodeSpacing + xOffset}`
        )
        node.setPosition = {
          x: BASE_NODE_HEIGHT + nodeSpacing + xOffset,
          y: nodeY
        }
        maxNodeBottom = Math.max(maxNodeBottom, node.y + node.height)
      }
    }

    return maxNodeBottom
  }

  generateFlowConnectors() {
    let xSourceOffsetMap: Partial<Record<NodeLevel, number>> = {}
    const xTargetOffsetMap: Partial<Record<NodeLevel, number>> = {}

    const iterations: Array<{
      reverse: boolean
      levelComparer: LevelComparerResult[]
      connectorType: ConnectorType
    }> = [
      { reverse: true, levelComparer: ['above-next'], connectorType: 'below' },
      {
        reverse: false,
        levelComparer: ['same', 'previous', 'before-previous'],
        connectorType: 'above'
      },
      { reverse: true, levelComparer: ['next'], connectorType: 'middle' }
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
            if (i.levelComparer.includes(relation)) {
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
    const baseAutobahn = direction === 'below' ? this.LOW_AUTOBAHN_BASE : this.UPPER_AUTOBAHN_BASE
    const curr = direction === 'below' ? this.lowBahnCurrentUsage : this.upBahnCurrentUsage

    if (direction === 'below') {
      // Update usage tracking
      this.lowBahnCurrentUsage += strokeWidth
    } else {
      // Update usage tracking
      this.upBahnCurrentUsage += strokeWidth
    }
    return baseAutobahn - strokeWidth / 2 - curr
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
