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
    this.applySumNodeGeometry()

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
    const dumpNode = new NodeDrawer('heat', 'dump', 0, '#e04c4cff', { width: x2 - x1, height: 100 }, 'Heat')
    dumpNode.setPosition = { x: x1, y: this.DUMP_NODE_Y }
    return dumpNode
  }

  /** Sum nodes and the addon nodes they aggregate. */
  private getSumGroups(): { sum: EnergyNode; addons: EnergyNode[] }[] {
    return this.energyNodes
      .filter((n) => n.isSumNode)
      .map((sum) => ({
        sum,
        addons: sum.addonIds
          .map((id) => this.energyNodes.find((n) => n.id === id))
          .filter((n): n is EnergyNode => !!n)
      }))
      .filter((g) => g.addons.length > 0)
  }

  private addonToSum = new Map<string, EnergyNode>()

  /** Half-width addons; sum height = total addon height. */
  private applySumNodeGeometry() {
    this.addonToSum.clear()
    for (const { sum, addons } of this.getSumGroups()) {
      for (const addon of addons) {
        this.addonToSum.set(addon.id, sum)
        addon.setSize = { width: BASE_NODE_WIDTH / 2, height: addon.height }
      }
      const totalHeight = addons.reduce((h, a) => h + a.height, 0)
      sum.setSize = { width: BASE_NODE_WIDTH / 2, height: totalHeight }
    }
  }

  private sameSumGroup(a?: EnergyNode, b?: EnergyNode): boolean {
    if (!a || !b) return false
    const sumA = this.addonToSum.get(a.id)
    const sumB = this.addonToSum.get(b.id)
    return !!sumA && sumA === sumB
  }

  /**
   * Inline sum nodes sit in their addons' column, so their outgoing lanes
   * (heat + energy) must share that column's horizontal offset pool.
   */
  private visualSourceLevel(node: EnergyNode): NodeLevel {
    if (node.isSumNode) {
      const group = this.getSumGroups().find((g) => g.sum === node)
      if (group?.addons[0]) return group.addons[0].level.id
    }
    return node.level.id
  }

  private gapAfterNode(node: EnergyNode, nextNode?: EnergyNode) {
    if (!nextNode) return this.NODES_VERTICAL_SPACING
    // Addon siblings of a sum sit flush (no vertical gap).
    if (this.sameSumGroup(node, nextNode)) return 0
    const maxGap = 40
    const fraction = 0.2
    return Math.min(
      maxGap,
      Math.max(this.NODES_VERTICAL_SPACING, fraction * Math.min(node.height, nextNode.height))
    )
  }

  /** Place sum node immediately to the right of its stacked addons. */
  private placeSumBesideAddons(sum: EnergyNode, addons: EnergyNode[]) {
    if (addons.length === 0) return
    const top = Math.min(...addons.map((a) => a.y))
    const left = Math.min(...addons.map((a) => a.x))
    sum.setPosition = {
      x: left + addons[0].width,
      y: top
    }
  }

  computeNodePositions(verticalUsageByLevel: Record<NodeLevel, number>) {
    let maxNodeBottom = 0
    let xOffset = 0
    for (const level of NodeLevels) {
      const nodesInLevel = this.energyNodes.filter((n) => n.level.id === level)
      const inlineSums = nodesInLevel.filter((n) => n.isSumNode)
      const regularNodes = nodesInLevel.filter((n) => !n.isSumNode)

      if (nodeLevelValue(level)) {
        const prevVerticalUsage = verticalUsageByLevel[prevLevel(level)]
        xOffset += (prevVerticalUsage ?? 0) * BASE_NODE_HEIGHT + 30
      }

      const previousLevel = nodeLevelValue(level) > 0 ? prevLevel(level) : undefined
      for (let i = 0; i < regularNodes.length; i++) {
        const node = regularNodes[i]
        const prevSibling = i > 0 ? regularNodes[i - 1] : undefined
        const nodeSpacing = BASE_NODE_WIDTH * (node.level.value - 1)
        const peer =
          previousLevel === 'extraction'
            ? this.energyNodes.find(
                (n) =>
                  n.level.id === previousLevel &&
                  n.level.position === node.level.position &&
                  !n.isSumNode
              )
            : undefined

        let nodeY: number
        if (prevSibling && this.sameSumGroup(prevSibling, node)) {
          nodeY = prevSibling.y + prevSibling.height
        } else if (peer && prevSibling) {
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

      // Place sum nodes directly after their addon stack.
      for (const sum of inlineSums) {
        const group = this.getSumGroups().find((g) => g.sum === sum)
        if (!group) continue
        this.placeSumBesideAddons(sum, group.addons)
        maxNodeBottom = Math.max(maxNodeBottom, sum.y + sum.height)
      }
    }

    return maxNodeBottom
  }

  generateFlowConnectors() {
    let xSourceOffsetMap: Partial<Record<NodeLevel, number>> = {}
    const xTargetOffsetMap: Partial<Record<NodeLevel, number>> = {}

    // Place all heat dumps first so their lanes are a contiguous block per visual column.
    const dumpReservedWidth: Partial<Record<NodeLevel, number>> = {}
    for (const level of NodeLevels) {
      dumpReservedWidth[level] = 0
      xSourceOffsetMap[level] = 0
    }
    for (const level of [...NodeLevels].reverse()) {
      for (const node of [...this.energyNodes.filter((n) => n.level.id === level)].reverse()) {
        const laneLevel = this.visualSourceLevel(node)
        if (!xSourceOffsetMap[laneLevel]) xSourceOffsetMap[laneLevel] = 0

        if (this.addonToSum.has(node.id)) continue

        if (node.isSumNode) {
          const sumDumps = this.createSumDumpConnectors(node, xSourceOffsetMap[laneLevel] ?? 0)
          for (const dumpConnector of sumDumps) {
            xSourceOffsetMap[laneLevel]! += dumpConnector.strokeWidth
            this.connectors.push(dumpConnector)
          }
        } else {
          const dumpConnector = this.createDumpConnector(node, xSourceOffsetMap[laneLevel] ?? 0)
          xSourceOffsetMap[laneLevel]! += dumpConnector.strokeWidth
          this.connectors.push(dumpConnector)
        }
      }
    }
    for (const level of NodeLevels) {
      dumpReservedWidth[level] = xSourceOffsetMap[level] ?? 0
    }

    const iterations: Array<{
      reverse: boolean
      levelComparer: LevelComparerResult[]
      connectorType: ConnectorType
      lanePool: 'down' | 'up'
    }> = [
      { reverse: true, levelComparer: ['above-next'], connectorType: 'below', lanePool: 'down' },
      {
        reverse: false,
        levelComparer: ['same', 'previous', 'before-previous'],
        connectorType: 'above',
        lanePool: 'up'
      },
      { reverse: false, levelComparer: ['next'], connectorType: 'middle', lanePool: 'down' }
    ]

    // Below + middle share one downward exit-lane pool (starts after heat dumps).
    const downLaneOffsets: Partial<Record<NodeLevel, number>> = {}
    for (const level of NodeLevels) {
      downLaneOffsets[level] = dumpReservedWidth[level] ?? 0
    }

    for (const i of iterations) {
      function r<T>(arr: Array<T>, rev: boolean) {
        return rev ? arr.reverse() : arr
      }

      if (i.lanePool === 'up') {
        xSourceOffsetMap = {}
        for (const level of NodeLevels) {
          xSourceOffsetMap[level] = dumpReservedWidth[level] ?? 0
        }
      } else {
        xSourceOffsetMap = downLaneOffsets
      }

      for (const level of NodeLevels) {
        for (const node of r(
          this.energyNodes.filter((n) => n.level.id === level),
          i.reverse
        )) {
          let outputs = Object.entries(node.outputMap).filter(([id, power]) => {
            if (!power) return false
            const targetNode = this.energyNodes.find((n) => n.id === id)
            if (!targetNode) return false
            if (this.addonToSum.get(node.id) === targetNode) return false
            return i.levelComparer.includes(this.levelComparer(node, targetNode).interLevel)
          })

          if (i.connectorType === 'middle') {
            // Lower targets first → inner lanes (needed for vertical-first, non-crossing).
            outputs = outputs.sort((a, b) => {
              const ta = this.energyNodes.find((n) => n.id === a[0])!
              const tb = this.energyNodes.find((n) => n.id === b[0])!
              return tb.y + tb.height / 2 - (ta.y + ta.height / 2)
            })
          } else {
            outputs = r(outputs, i.reverse)
          }

          for (const [targetNodeId, power] of outputs) {
            const targetNode = this.energyNodes.find((n) => n.id === targetNodeId)!
            this.connectors.push(
              this.createConnector(
                node,
                targetNode,
                power,
                xSourceOffsetMap,
                xTargetOffsetMap,
                i.connectorType
              )
            )
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

    if (!xTargetOffsetMap[target.level.id]) {
      xTargetOffsetMap[target.level.id] = 0
    }

    const sourceYOffset = this.calculateYOffset(source, target.id, false)
    const targetYOffset = this.calculateYOffset(target, source.id, true)
    const targetXOffset = (xTargetOffsetMap[target.level.id]! ?? 0) + strokeWidth

    const sourceLaneLevel = this.visualSourceLevel(source)
    if (!xSourceOffsetMap[sourceLaneLevel]) xSourceOffsetMap[sourceLaneLevel] = 0
    const sourceXOffset = 10 + (xSourceOffsetMap[sourceLaneLevel]! ?? 0) + strokeWidth / 2

    xTargetOffsetMap[target.level.id]! = targetXOffset
    // Always advance source lanes — including middle — so multi-target exits diverge.
    const laneGap = connectorType === 'middle' ? 8 : 0
    xSourceOffsetMap[sourceLaneLevel]! += strokeWidth + laneGap

    const sourceX = source.x + source.width
    const sourceY = source.y + sourceYOffset + strokeWidth / 2
    const targetX = target.x
    const targetY = target.y + strokeWidth / 2 + targetYOffset

    let points: number[]

    if (connectorType === 'middle') {
      // Vertical-first: reach target Y on the exit lane, then run horizontal.
      // Horizontal-first lets one connector's drop cut through another's run.
      const laneX = sourceX + sourceXOffset
      const approachX = Math.max(laneX, targetX - targetXOffset + strokeWidth / 2 - 10)
      points = [sourceX, sourceY, laneX, sourceY, laneX, targetY, approachX, targetY, targetX, targetY]
    } else {
      const yAutobahn = this.calculateAutobahnY(connectorType, strokeWidth)
      const horizontalX = targetX - targetXOffset + strokeWidth / 2 - 10
      points = [
        sourceX,
        sourceY,
        sourceX + sourceXOffset,
        sourceY,
        sourceX + sourceXOffset,
        yAutobahn,
        horizontalX,
        yAutobahn,
        horizontalX,
        targetY,
        targetX,
        targetY
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

  /** One heat connector per addon, stacked below the sum node's useful outputs. */
  createSumDumpConnectors(sum: EnergyNode, startOffset: number): Connector[] {
    const group = this.getSumGroups().find((g) => g.sum === sum)
    if (!group) return []

    const connectors: Connector[] = []
    let offset = startOffset
    // Same rule as createDumpConnector: losses sit below useful output on the
    // node's right edge. Split that loss band into one segment per addon.
    let yCursor = sum.y + sum.outputPower * BASE_NODE_HEIGHT

    // Preserve vertical order of addons as laid out.
    const addons = [...group.addons].sort((a, b) => a.y - b.y)

    for (const addon of addons) {
      const strokeWidth = addon.losses * BASE_NODE_HEIGHT
      if (strokeWidth <= 0) continue

      const xOffset = offset + 10 + strokeWidth / 2
      const sourceX = sum.x + sum.width
      const sourceY = yCursor + strokeWidth / 2

      connectors.push({
        id: `${sum.id}-dump-${addon.id}`,
        from: sum.id,
        to: 'Dump',
        points: [sourceX, sourceY, sourceX + xOffset, sourceY, sourceX + xOffset, this.DUMP_NODE_Y],
        power: addon.losses,
        strokeWidth,
        color: '#e04c4cff'
      })

      offset += strokeWidth
      yCursor += strokeWidth
    }

    return connectors
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
