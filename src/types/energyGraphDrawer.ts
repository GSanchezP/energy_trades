import { EnergyNode } from './energyNode'
import {
  BASE_NODE_HEIGHT,
  BASE_NODE_WIDTH,
  NodeDrawer,
  nextLevel,
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

    this.upBahnCurrentUsage = 0
    this.UPPER_AUTOBAHN_BASE = -this.NODES_VERTICAL_SPACING
    const belowBahnHeight = this.calculateLowBahnUsage() * BASE_NODE_HEIGHT
    this.lowBahnCurrentUsage = 0

    // Vertical packing doesn't depend on the corridor widths, so lay the
    // columns out once to learn the Y positions, then again once the exact
    // corridor width of each gap can be measured.
    this.computeNodePositions({})
    const maxNodeBottom = this.computeNodePositions(this.computeGapWidths())

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

  /**
   * Exact pixel width of the connector corridor drawn to the right of each
   * column. Heat dumps and bus exit lanes pack from the source edge, inbound
   * bus approaches pack from the target edge, and next-column verticals fill
   * the space between them, so the corridor is the sum of those bands.
   * Requires node Y positions, which decide whether a next-column link is a
   * straight hop or needs a vertical lane.
   */
  private computeGapWidths(): Partial<Record<NodeLevel, number>> {
    const widths: Partial<Record<NodeLevel, number>> = {}

    for (const level of NodeLevels) {
      const next = nextLevel(level)
      let dumps = 0
      let upExits = 0
      let downExits = 0
      let middles = 0
      let approaches = 0

      for (const node of this.energyNodes) {
        if (this.addonToSum.has(node.id)) continue
        if (node.isIsolated) continue
        if (this.visualSourceLevel(node) !== level) continue
        if (node.isSumNode) {
          const group = this.getSumGroups().find((g) => g.sum === node)
          for (const addon of group?.addons ?? []) dumps += addon.losses * BASE_NODE_HEIGHT
        } else {
          dumps += node.losses * BASE_NODE_HEIGHT
        }
      }

      for (const node of this.energyNodes) {
        if (node.isIsolated) continue
        for (const [targetId, power] of Object.entries(node.outputMap)) {
          if (!power) continue
          const target = this.energyNodes.find((n) => n.id === targetId)
          if (!target) continue
          // Addons feed their sum internally; no lane is drawn for that.
          if (this.addonToSum.get(node.id) === target) continue

          const width = power * BASE_NODE_HEIGHT
          const relation = this.levelComparer(node, target).interLevel

          if (relation === 'next') {
            if (target.level.id === next && this.middleNeedsVertical(node, target)) {
              middles += width
            }
            continue
          }

          // Bus-routed links take an exit lane in the source column's corridor.
          // Upper and lower bus exits reuse the same lane pool, so they only
          // need room for whichever side is wider.
          if (this.visualSourceLevel(node) === level) {
            if (relation === 'above-next') downExits += width
            else upExits += width
          }
          // ...and an approach lane in the corridor before the target column.
          if (target.level.id === next) approaches += width
        }
      }

      // 10px lead-in for exits, 10px between the middle and approach bands,
      // and 10px before the target face.
      widths[level] = dumps + Math.max(upExits, downExits) + middles + approaches + 30
    }

    return widths
  }

  /** A next-column link only needs a vertical lane when its ends misalign. */
  private middleNeedsVertical(source: EnergyNode, target: EnergyNode): boolean {
    const sourceY = source.y + this.calculateYOffset(source, target.id, false)
    const targetY = target.y + this.calculateYOffset(target, source.id, true)
    return Math.abs(sourceY - targetY) > 1
  }

  addDumpNode(): NodeDrawer {
    const x1 = Math.min(...this.energyNodes.map((n) => n.x))
    const x2 = Math.max(...this.energyNodes.map((n) => n.x + n.width + 120))
    // At least half the thickest dump ribbon so Heat doesn't look like a hairline.
    let maxDumpStroke = 0
    for (const node of this.energyNodes) {
      if (this.addonToSum.has(node.id)) continue
      if (node.isSumNode) {
        const group = this.getSumGroups().find((g) => g.sum === node)
        for (const addon of group?.addons ?? []) {
          maxDumpStroke = Math.max(maxDumpStroke, addon.losses * BASE_NODE_HEIGHT)
        }
      } else {
        maxDumpStroke = Math.max(maxDumpStroke, node.losses * BASE_NODE_HEIGHT)
      }
    }
    const height = Math.max(40, maxDumpStroke / 2)
    const dumpNode = new NodeDrawer('heat', 'dump', 0, '#c93030ff', { width: x2 - x1, height }, 'Heat')
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

  computeNodePositions(gapWidths: Partial<Record<NodeLevel, number>>) {
    let maxNodeBottom = 0
    let xOffset = 0
    for (const level of NodeLevels) {
      const nodesInLevel = this.energyNodes.filter((n) => n.level.id === level)
      const inlineSums = nodesInLevel.filter((n) => n.isSumNode)
      const regularNodes = nodesInLevel.filter((n) => !n.isSumNode)

      if (nodeLevelValue(level)) {
        xOffset += gapWidths[prevLevel(level)] ?? 0
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
    // Approach lanes immediately left of each target column (above/below entry only).
    const xTargetOffsetMap: Partial<Record<NodeLevel, number>> = {}
    const approachReservedWidth: Partial<Record<NodeLevel, number>> = {}
    // Middle verticals pack left of the approach corridor (per target level).
    const middleLaneOffset: Partial<Record<NodeLevel, number>> = {}

    for (const level of NodeLevels) {
      approachReservedWidth[level] = 0
      middleLaneOffset[level] = 0
    }

    // Width of above/below inbound ribbons — reserved so middle lanes stay clear.
    for (const node of this.energyNodes) {
      if (node.isIsolated) continue
      for (const [targetId, power] of Object.entries(node.outputMap)) {
        if (!power) continue
        const target = this.energyNodes.find((n) => n.id === targetId)
        if (!target || target.isIsolated) continue
        if (this.addonToSum.get(node.id) === target) continue
        const rel = this.levelComparer(node, target).interLevel
        if (['same', 'previous', 'before-previous', 'above-next'].includes(rel)) {
          approachReservedWidth[target.level.id] =
            (approachReservedWidth[target.level.id] ?? 0) + power * BASE_NODE_HEIGHT
        }
      }
    }

    // Place all heat dumps first so their lanes are a contiguous block per visual column.
    const dumpReservedWidth: Partial<Record<NodeLevel, number>> = {}
    for (const level of NodeLevels) {
      dumpReservedWidth[level] = 0
      xSourceOffsetMap[level] = 0
    }
    for (const level of [...NodeLevels].reverse()) {
      for (const node of [...this.energyNodes.filter((n) => n.level.id === level)].reverse()) {
        if (node.isIsolated) continue
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

    type PendingEdge = { source: EnergyNode; target: EnergyNode; power: number }

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

      const pending: PendingEdge[] = []

      for (const level of NodeLevels) {
        for (const node of r(
          this.energyNodes.filter((n) => n.level.id === level),
          i.reverse
        )) {
          if (node.isIsolated) continue
          let outputs = Object.entries(node.outputMap).filter(([id, power]) => {
            if (!power) return false
            const targetNode = this.energyNodes.find((n) => n.id === id)
            if (!targetNode || targetNode.isIsolated) return false
            if (this.addonToSum.get(node.id) === targetNode) return false
            return i.levelComparer.includes(this.levelComparer(node, targetNode).interLevel)
          })

          if (i.connectorType !== 'middle') {
            outputs = r(outputs, i.reverse)
          }

          for (const [targetNodeId, power] of outputs) {
            const targetNode = this.energyNodes.find((n) => n.id === targetNodeId)!
            pending.push({ source: node, target: targetNode, power })
          }
        }
      }

      // Above/below: assign approach lanes by entry Y so inbound verticals nest
      // instead of crossing (inner = closer to the node face).
      if (i.connectorType === 'above' || i.connectorType === 'below') {
        const entryY = (e: PendingEdge) =>
          e.target.y +
          this.calculateYOffset(e.target, e.source.id, true) +
          (e.power * BASE_NODE_HEIGHT) / 2
        if (i.connectorType === 'above') {
          // From upper bus dropping down: higher entries first → inner lanes.
          pending.sort((a, b) => entryY(a) - entryY(b))
        } else {
          // From lower bus rising up: lower entries first → inner lanes.
          pending.sort((a, b) => entryY(b) - entryY(a))
        }
      }

      // Middle: lanes are packed from the target face outwards, so the first
      // edge emitted turns last. An edge must turn before every edge it would
      // otherwise cut across: among rising flows the lowest entry turns last,
      // among falling flows the highest entry turns last.
      if (i.connectorType === 'middle') {
        const entryY = (e: PendingEdge) =>
          e.target.y +
          this.calculateYOffset(e.target, e.source.id, true) +
          (e.power * BASE_NODE_HEIGHT) / 2
        const exitY = (e: PendingEdge) =>
          e.source.y +
          this.calculateYOffset(e.source, e.target.id, false) +
          (e.power * BASE_NODE_HEIGHT) / 2
        const rises = (e: PendingEdge) => entryY(e) < exitY(e)
        pending.sort((a, b) => {
          if (rises(a) !== rises(b)) return rises(a) ? 1 : -1
          return rises(a) ? entryY(b) - entryY(a) : entryY(a) - entryY(b)
        })
      }

      for (const edge of pending) {
        this.connectors.push(
          this.createConnector(
            edge.source,
            edge.target,
            edge.power,
            xSourceOffsetMap,
            xTargetOffsetMap,
            i.connectorType,
            approachReservedWidth,
            middleLaneOffset
          )
        )
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
    connectorType: ConnectorType,
    approachReservedWidth: Partial<Record<NodeLevel, number>>,
    middleLaneOffset: Partial<Record<NodeLevel, number>>
  ): Connector {
    const strokeWidth = power * BASE_NODE_HEIGHT

    if (!xTargetOffsetMap[target.level.id]) {
      xTargetOffsetMap[target.level.id] = 0
    }

    const sourceYOffset = this.calculateYOffset(source, target.id, false)
    const targetYOffset = this.calculateYOffset(target, source.id, true)

    const sourceLaneLevel = this.visualSourceLevel(source)
    if (!xSourceOffsetMap[sourceLaneLevel]) xSourceOffsetMap[sourceLaneLevel] = 0
    const sourceXOffset = 10 + (xSourceOffsetMap[sourceLaneLevel]! ?? 0) + strokeWidth / 2

    const sourceX = source.x + source.width
    const sourceY = source.y + sourceYOffset + strokeWidth / 2
    const targetX = target.x
    const targetY = target.y + strokeWidth / 2 + targetYOffset

    let points: number[]

    if (connectorType === 'middle') {
      // Aligned next-column links (Coal→Thermal, Petroleum→Fuel) should cross
      // the gap directly. Consuming the shared lane pool makes the next
      // connector overshoot past the target and fold back.
      if (!this.middleNeedsVertical(source, target)) {
        points = [sourceX, sourceY, targetX, targetY]
      } else {
        xSourceOffsetMap[sourceLaneLevel]! += strokeWidth
        // Pack exclusively from the approach corridor leftward (entry-Y order),
        // so middle verticals never share an X with above/below approaches.
        const reserved = approachReservedWidth[target.level.id] ?? 0
        middleLaneOffset[target.level.id] =
          (middleLaneOffset[target.level.id] ?? 0) + strokeWidth
        const laneX = Math.max(
          sourceX + 10,
          targetX - reserved - 10 - middleLaneOffset[target.level.id]! + strokeWidth / 2
        )
        points = [sourceX, sourceY, laneX, sourceY, laneX, targetY, targetX, targetY]
      }
    } else {
      const targetXOffset = (xTargetOffsetMap[target.level.id]! ?? 0) + strokeWidth
      xTargetOffsetMap[target.level.id]! = targetXOffset
      xSourceOffsetMap[sourceLaneLevel]! += strokeWidth

      const yAutobahn = this.calculateAutobahnY(connectorType, strokeWidth)
      // Approach verticals nest from the target face by entry-Y emission order.
      const horizontalX = targetX - targetXOffset + strokeWidth / 2 - 10
      const exitX = sourceX + sourceXOffset
      points = [
        sourceX,
        sourceY,
        exitX,
        sourceY,
        exitX,
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

    // Same rule as createDumpConnector: losses sit below useful output on the
    // node's right edge. Split that loss band into one segment per addon.
    let yCursor = sum.y + sum.outputPower * BASE_NODE_HEIGHT

    // Top→bottom attachment order on the sum's right edge.
    const addons = [...group.addons].sort((a, b) => a.y - b.y)
    const segments: { id: string; strokeWidth: number; sourceY: number; power: number }[] = []

    for (const addon of addons) {
      const strokeWidth = addon.losses * BASE_NODE_HEIGHT
      if (strokeWidth <= 0) continue
      segments.push({
        id: addon.id,
        strokeWidth,
        sourceY: yCursor + strokeWidth / 2,
        power: addon.losses
      })
      yCursor += strokeWidth
    }

    // Going down: lower exits need inner lanes, upper exits outer — otherwise
    // the upper vertical cuts through the lower horizontal.
    let offset = startOffset
    const laneXOffsets = new Array<number>(segments.length)
    for (let i = segments.length - 1; i >= 0; i--) {
      laneXOffsets[i] = offset + 10 + segments[i].strokeWidth / 2
      offset += segments[i].strokeWidth
    }

    const sourceX = sum.x + sum.width
    return segments.map((seg, i) => {
      const laneX = sourceX + laneXOffsets[i]
      return {
        id: `${sum.id}-dump-${seg.id}`,
        from: sum.id,
        to: 'Dump',
        points: [sourceX, seg.sourceY, laneX, seg.sourceY, laneX, this.DUMP_NODE_Y],
        power: seg.power,
        strokeWidth: seg.strokeWidth,
        color: '#e04c4cff'
      }
    })
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
