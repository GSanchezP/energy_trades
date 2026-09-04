<template>
  <div class="canvas-container">
    <header class="summary-header">
      <div class="summary-metric summary-co2">
        <span class="summary-label">CO₂</span>
        <span class="summary-value">{{ formatSummary(summaryTotals.co2) }}</span>
      </div>
      <div class="summary-metric summary-needs">
        <span class="summary-label">Basic Needs</span>
        <span class="summary-value">{{ formatSummary(summaryTotals.wellBeing) }}</span>
      </div>
      <div class="summary-metric summary-leisure">
        <span class="summary-label">Leisure</span>
        <span class="summary-value">{{ formatSummary(summaryTotals.leisure) }}</span>
      </div>
      <fieldset class="summary-objective" :disabled="isSolving">
        <legend class="summary-label">Solve for</legend>
        <label class="objective-option">
          <input
            type="radio"
            name="solver-objective"
            value="maximize_leisure"
            v-model="solverObjective"
          />
          Maximize Leisure
        </label>
        <label class="objective-option">
          <input
            type="radio"
            name="solver-objective"
            value="minimize_co2"
            v-model="solverObjective"
          />
          Minimize CO₂
        </label>
      </fieldset>
      <button class="header-results-button" @click="handleResultsClick" title="Compute results">
        <i class="mdi mdi-cpu-64-bit button-icon"></i>
      </button>
    </header>

    <div v-if="factorSumWarnings.length" class="factor-warning" role="alert">
      <strong>Factor warning:</strong>
      each non-extraction factor node must sum to at least 1.
      <ul>
        <li v-for="msg in factorSumWarnings" :key="msg">{{ msg }}</li>
      </ul>
    </div>

    <div class="canvas-body">
      <div class="canvas-wrapper">
        <!-- Value Slider -->
        <div v-if="sliderState" class="value-slider-container">
          <div class="slider-header">
            <span class="slider-label">
              {{ sliderState.node?.id }} - {{ sliderState.nodeType }}
              <span v-if="sliderState.isAddon" class="addon-badge">(addon)</span>
            </span>
            <button class="slider-close" @click="closeSlider">
              <i class="mdi mdi-close"></i>
            </button>
          </div>
          <div class="slider-wrapper">
            <input
              type="range"
              class="vertical-slider"
              :min="sliderState.isAddon ? 0 : 0"
              :max="sliderState.isAddon ? 1 : 3"
              :step="0.001"
              :value="getSliderValue"
              @input="handleSliderChange"
              orient="vertical"
            />
            <div class="slider-value-display">
              <div class="slider-value">{{ getSliderDisplayValue }}</div>
              <div class="slider-min-max">
                <span>0</span>
                <span>{{ sliderState.isAddon ? 1 : 3 }}</span>
              </div>
            </div>
          </div>
          <div v-if="sliderState.isAddon" class="slider-actions">
            <button class="set-null-button" @click="setAddonToNull">Set to null</button>
          </div>
        </div>

        <v-stage
          ref="stageRef"
          :config="stageConfig"
          @wheel="handleWheel"
          @click="handleStageClick"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
        >
          <v-layer>
            <v-line
              v-for="connector in connectors"
              :key="connector.id"
              :config="{
                points: connector.points,
                stroke: connector.color,
                strokeWidth: connector.strokeWidth - 1.2,
                lineCap: 'square',
                lineJoin: 'square',
                opacity: selectedConnectorId === connector.id ? 0.8 : 0.6
              }"
              @click="(e: any) => handleConnectorClick(connector.id, e)"
            />

            <v-rect
              v-for="square in nodes"
              :key="square.id"
              :config="{
                x: square.x,
                y: square.y,
                width: square.width,
                height: square.height,
                fill: square.color,
                stroke: '#1e293b',
                strokeWidth: selectedSquareIds.has(square.id) ? 2 : 1,
                shadowBlur: 5,
                shadowColor: 'black',
                shadowOpacity: 0.2,
                opacity: 1
              }"
              @click="(e: any) => handleSquareClick(square.id, e)"
            />

            <v-text
              v-for="label in nodeLabels"
              :key="`text-${label.id}`"
              :config="label.config"
              @click="(e: any) => handleSquareClick(label.id, e)"
            />
          </v-layer>
        </v-stage>
      </div>
      <InfoPanel
        v-if="isInfoPanelVisible"
        :selectedNodes="selectedSquares"
        :selectedConnector="selectedConnector"
        :energyGraph="energyGraph"
        @update-config="handleConfigUpdate"
        @open-slider="handleOpenSlider"
        @close="closeInfoPanel"
      />
    </div>

    <!-- Results Modal -->
    <div v-if="showResultsModal" class="modal-overlay" @click="closeResultsModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Solver Results</h2>
          <button class="modal-close" @click="closeResultsModal">
            <i class="mdi mdi-close"></i>
          </button>
        </div>
        <div class="modal-body">
          <pre v-if="solverResultText" class="solver-result">{{ solverResultText }}</pre>
          <div v-else class="loading">Loading solver results...</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { Connector, EnergyGraphDrawer } from '../types/energyGraphDrawer'
import InfoPanel from './InfoPanel.vue'
import generateEnergyGraph, { type SolverObjective } from '../types/energyGraphGenerator'
import { getStoredSolverResult, formatSolverResult } from '../types/outputMapSolver'
import type { EnergyNode } from '../types/energyNode'
import { NodeType, nodesConfig, NodeConfig, getFactorSumFailures } from '../types/nodesConfig'
import type { NodeDrawer } from '../types/nodeDrawer'

const FPS_INTERVAL_IN_MS = 16
const SUMMARY_HEADER_HEIGHT = 56

const energyGraph = ref<EnergyGraphDrawer | undefined>(undefined)
const solverObjective = ref<SolverObjective>('maximize_leisure')
const isSolving = ref(false)
const stageRef = ref<any>(null)

const selectedSquareIds = ref<Set<string>>(new Set())
const selectedConnectorId = ref<string | null>(null)
const clickedOnElement = ref<boolean>(false)

// Window dimensions
const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)

// Pan state
const isPanning = ref<boolean>(false)
const lastPointerPosition = ref<{ x: number; y: number } | null>(null)
const panTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

/** Axis-aligned bounds of nodes + connector ribbons (includes upper/lower buses). */
function getGraphBounds() {
  const graph = energyGraph.value
  if (!graph) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const n of graph.nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.width)
    maxY = Math.max(maxY, n.y + n.height)
  }

  for (const c of graph.connectors) {
    const half = c.strokeWidth / 2
    for (let i = 0; i < c.points.length; i += 2) {
      minX = Math.min(minX, c.points[i] - half)
      maxX = Math.max(maxX, c.points[i] + half)
      minY = Math.min(minY, c.points[i + 1] - half)
      maxY = Math.max(maxY, c.points[i + 1] + half)
    }
  }

  if (!Number.isFinite(minX)) return null
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

/** Scale + pan so the full diagram fits and is centered in the stage. */
function fitGraphToView() {
  const stage = stageRef.value?.getNode()
  if (!stage || !energyGraph.value) return

  const bounds = getGraphBounds()
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return

  const padding = 48
  const viewW = stage.width()
  const viewH = stage.height()
  const scale = Math.min((viewW - padding * 2) / bounds.width, (viewH - padding * 2) / bounds.height)

  stage.scale({ x: scale, y: scale })
  stage.position({
    x: viewW / 2 - (bounds.minX + bounds.width / 2) * scale,
    y: viewH / 2 - (bounds.minY + bounds.height / 2) * scale
  })
}

// Handle window resize
const handleResize = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
  nextTick(() => fitGraphToView())
}

const regenerateGraph = async () => {
  isSolving.value = true
  try {
    energyGraph.value = await generateEnergyGraph(solverObjective.value)
    // Clear selection after regeneration
    selectedSquareIds.value.clear()
    selectedConnectorId.value = null
    await nextTick()
    // Konva stage may need a paint before getNode()/size are ready.
    requestAnimationFrame(() => fitGraphToView())
  } finally {
    isSolving.value = false
  }
}

watch(solverObjective, async () => {
  await regenerateGraph()
})

onMounted(async () => {
  await regenerateGraph()

  // Add resize listener
  window.addEventListener('resize', handleResize)
})

const handleConfigUpdate = async () => {
  await regenerateGraph()
}

// Slider state
const sliderState = ref<{
  node: EnergyNode
  nodeType: NodeType
  isAddon: boolean
} | null>(null)

const handleOpenSlider = (node: EnergyNode, nodeType: NodeType, isAddon: boolean) => {
  sliderState.value = { node, nodeType, isAddon }
}

const closeSlider = () => {
  sliderState.value = null
}

const getSliderValue = computed(() => {
  if (!sliderState.value) return 0
  const { node, nodeType, isAddon } = sliderState.value
  // Get current node from energyGraph to ensure we have the latest values
  const currentNode = energyGraph.value?.energyNodes.find((n) => n.id === node.id) || node
  if (isAddon) {
    const value = currentNode.eroiAddons[nodeType]
    if (value === null || value === undefined) return 0
    return value
  } else {
    return currentNode.eroiFactors[nodeType] || 0
  }
})

const getSliderDisplayValue = computed(() => {
  if (!sliderState.value) return '0'
  const { node, nodeType, isAddon } = sliderState.value
  // Get current node from energyGraph to ensure we have the latest values
  const currentNode = energyGraph.value?.energyNodes.find((n) => n.id === node.id) || node
  if (isAddon) {
    const value = currentNode.eroiAddons[nodeType]
    if (value === null) return 'null'
    if (value === undefined) return '0'
    return value.toFixed(3)
  } else {
    return (currentNode.eroiFactors[nodeType] || 0).toFixed(3)
  }
})

// Debounce for slider updates
let sliderUpdateTimeout: ReturnType<typeof setTimeout> | null = null

const handleSliderChange = async (event: Event) => {
  if (!sliderState.value) return
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value) || 0

  const { node, nodeType, isAddon } = sliderState.value
  const nodeConfig = nodesConfig.nodes.find((n) => n.id === node.id)
  if (!nodeConfig) return

  if (isAddon) {
    // Update addon
    const newAddons = { ...nodeConfig.addons }
    newAddons[nodeType] = value
    const index = nodesConfig.nodes.findIndex((n) => n.id === node.id)
    if (index !== -1) {
      nodesConfig.nodes[index] = new NodeConfig(
        nodeConfig.id,
        nodeConfig.label,
        nodeConfig.level,
        nodeConfig.color,
        nodeConfig.factors,
        newAddons,
        nodeConfig.minOutput,
        nodeConfig.co2
      )
    }
  } else {
    // Update factor
    const newFactors = { ...nodeConfig.factors }
    if (value === 0) {
      delete newFactors[nodeType]
    } else {
      newFactors[nodeType] = value
    }
    const index = nodesConfig.nodes.findIndex((n) => n.id === node.id)
    if (index !== -1) {
      nodesConfig.nodes[index] = new NodeConfig(
        nodeConfig.id,
        nodeConfig.label,
        nodeConfig.level,
        nodeConfig.color,
        newFactors,
        nodeConfig.addons,
        nodeConfig.minOutput,
        nodeConfig.co2
      )
    }
  }

  // Update slider state to reflect new value
  if (sliderState.value.node) {
    // The node will be updated when graph regenerates, but we need to update the slider state
    // For now, just update the display value by regenerating
  }

  // Debounce graph regeneration to avoid too many updates
  if (sliderUpdateTimeout) {
    clearTimeout(sliderUpdateTimeout)
  }
  sliderUpdateTimeout = setTimeout(async () => {
    await regenerateGraph()
    // Update slider state with new node reference
    if (sliderState.value && energyGraph.value) {
      const updatedNode = energyGraph.value.energyNodes.find(
        (n) => n.id === sliderState.value!.node.id
      )
      if (updatedNode) {
        sliderState.value.node = updatedNode
      }
    }
  }, 50)
}

const setAddonToNull = async () => {
  if (!sliderState.value || !sliderState.value.isAddon) return

  const { node, nodeType } = sliderState.value
  const nodeConfig = nodesConfig.nodes.find((n) => n.id === node.id)
  if (!nodeConfig) return

  const newAddons = { ...nodeConfig.addons }
  newAddons[nodeType] = null

  const index = nodesConfig.nodes.findIndex((n) => n.id === node.id)
  if (index !== -1) {
    nodesConfig.nodes[index] = new NodeConfig(
      nodeConfig.id,
      nodeConfig.label,
      nodeConfig.level,
      nodeConfig.color,
      nodeConfig.factors,
      newAddons,
      nodeConfig.minOutput,
      nodeConfig.co2
    )
  }

  await regenerateGraph()
}

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const nodes = computed(() => {
  return energyGraph.value?.nodes || []
})

function buildNodeLabelConfig(square: NodeDrawer) {
  const padX = Math.min(4, Math.max(1, square.width * 0.05))
  const padY = Math.min(2, Math.max(0.5, square.height * 0.05))
  const label = square.label

  const longestWord = label
    .split(/[\s\n]+/)
    .filter(Boolean)
    .reduce((a, b) => (a.length >= b.length ? a : b), '')

  const textWidth = Math.max(2, square.width - padX * 2)
  const textHeight = Math.max(2, square.height - padY * 2)
  const maxFromWidth = textWidth / Math.max(1, longestWord.length * 0.56)
  const maxFromHeight = textHeight * 0.5
  // Always keep the label inside the node — allow very small type on tiny boxes.
  const fontSize = Math.max(3, Math.min(16, maxFromWidth, maxFromHeight))

  return {
    id: square.id,
    config: {
      x: square.x + padX,
      y: square.y + padY,
      width: textWidth,
      height: textHeight,
      text: label,
      fontSize,
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      wrap: 'word',
      ellipsis: true,
      lineHeight: 1.05,
      listening: true
    }
  }
}

const nodeLabels = computed(() => {
  return nodes.value.map((n) => buildNodeLabelConfig(n))
})

const connectors = computed<Connector[]>(() => {
  return energyGraph.value?.connectors?.filter((c) => c.power) || []
})

const selectedSquares = computed(() => {
  return nodes.value.filter((sq) => selectedSquareIds.value.has(sq.id))
})

const selectedConnector = computed((): Connector | null => {
  if (!selectedConnectorId.value) return null
  return connectors.value.find((conn) => conn.id === selectedConnectorId.value) || null
})

// Check if InfoPanel should be visible
const isInfoPanelVisible = computed(() => {
  return selectedSquares.value.length > 0 || selectedConnector.value !== null
})

const closeInfoPanel = () => {
  selectedSquareIds.value.clear()
  selectedConnectorId.value = null
}

// Calculate canvas dimensions - full width when panel is hidden, reduced when visible
const stageConfig = computed(() => ({
  width: isInfoPanelVisible.value ? windowWidth.value - 350 : windowWidth.value,
  height:
    windowHeight.value -
    SUMMARY_HEADER_HEIGHT -
    (factorSumWarnings.value.length > 0 ? 72 : 0)
}))

function formatSummary(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  if (value < 0.001) return value.toExponential(2)
  return value.toFixed(3)
}

const summaryTotals = computed(() => {
  // Depend on energyGraph so values refresh after each solve.
  void energyGraph.value
  const vars = getStoredSolverResult()?.result?.vars
  return {
    co2: vars?.['T:co2'] ?? 0,
    wellBeing: vars?.['T:wellBeing'] ?? 0,
    leisure: vars?.['T:leisure'] ?? 0
  }
})

/** Recompute when the graph regenerates (config/slider edits rebuild nodesConfig entries). */
const factorSumWarnings = computed(() => {
  void energyGraph.value
  return getFactorSumFailures(nodesConfig.nodes)
})

const handleWheel = (e: any) => {
  e.evt.preventDefault()

  const stage = stageRef.value?.getNode()
  const oldScale = stage.scaleX()
  const pointer = stage.getPointerPosition()

  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale
  }

  // how to scale? Zoom in? Or zoom out?
  let direction = e.evt.deltaY < 0 ? 1 : -1

  // when we zoom on trackpad, e.evt.ctrlKey is true
  // in that case lets revert direction
  if (e.evt.ctrlKey) {
    direction = -direction
  }

  const scaleBy = 1.06
  const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy

  stage.scale({ x: newScale, y: newScale })

  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale
  }
  stage.position(newPos)
}

const handleSquareClick = (squareId: string, _event: { evt: MouseEvent }) => {
  console.log(`Clicked on ${squareId}`)
  clickedOnElement.value = true
  // Clear connector selection when clicking on nodes
  selectedConnectorId.value = null

  // Disable multiple selection - always select only one
  selectedSquareIds.value.clear()
  selectedSquareIds.value.add(squareId)
}

const handleConnectorClick = (connectorId: string, _event: { evt: MouseEvent }) => {
  clickedOnElement.value = true
  selectedConnectorId.value = connectorId
  selectedSquareIds.value.clear() // Clear node selection
}

const handleStageClick = (_event: { evt: MouseEvent }) => {
  // Only clear if we didn't click on a square or connector
  if (!clickedOnElement.value) {
    selectedSquareIds.value.clear()
    selectedConnectorId.value = null
  }
  // Reset the flag for next click
  clickedOnElement.value = false
}

const handleMouseDown = (event: { evt: MouseEvent }) => {
  // Check if middle mouse button (wheel) is pressed
  if (event.evt.button === 1) {
    isPanning.value = true
    const stage = stageRef.value?.getNode()
    if (stage) {
      const pointer = stage.getPointerPosition()
      lastPointerPosition.value = { x: pointer.x, y: pointer.y }
    }
    event.evt.preventDefault()
  }
}

const handleMouseMove = (_event: { evt: MouseEvent }) => {
  if (!isPanning.value || !lastPointerPosition.value) return

  // Clear existing timeout
  if (panTimeout.value) {
    return // TODO: clearTimeout(panTimeout.value)
  }

  // Throttle panning updates to every 16ms (~60fps)
  panTimeout.value = setTimeout(() => {
    const stage = stageRef.value?.getNode()
    if (!stage || !isPanning.value || !lastPointerPosition.value) return

    const pointer = stage.getPointerPosition()
    const dx = pointer.x - lastPointerPosition.value.x
    const dy = pointer.y - lastPointerPosition.value.y

    const currentPos = stage.position()
    stage.position({
      x: currentPos.x + dx,
      y: currentPos.y + dy
    })

    lastPointerPosition.value = { x: pointer.x, y: pointer.y }
    panTimeout.value = null
  }, FPS_INTERVAL_IN_MS)
}

const handleMouseUp = (event: { evt: MouseEvent }) => {
  if (event.evt.button === 1) {
    isPanning.value = false
    lastPointerPosition.value = null

    // Clear any pending timeout
    if (panTimeout.value) {
      clearTimeout(panTimeout.value)
      panTimeout.value = null
    }
  }
}

const showResultsModal = ref(false)
const solverResultText = ref<string>('')

const handleResultsClick = () => {
  showResultsModal.value = true

  const result = getStoredSolverResult()
  if (result) {
    solverResultText.value = formatSolverResult(result, solverObjective.value)
  } else {
    solverResultText.value = 'Solver result not available. Please wait for the graph to load.'
  }
}

const closeResultsModal = () => {
  showResultsModal.value = false
}
</script>

<style scoped>
.canvas-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.summary-header {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
  z-index: 20;
}

.summary-metric {
  flex: 1;
  max-width: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 16px;
  border-right: 1px solid #1e293b;
}

.summary-metric:last-child {
  border-right: none;
}

.summary-objective {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  margin: 0;
  padding: 0 20px;
  border: none;
  border-left: 1px solid #1e293b;
  min-width: 280px;
}

.summary-objective legend {
  float: left;
  margin-right: 12px;
  padding: 0;
}

.objective-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  cursor: pointer;
  white-space: nowrap;
}

.objective-option input {
  accent-color: #38bdf8;
  cursor: pointer;
}

.summary-objective:disabled {
  opacity: 0.6;
}

.factor-warning {
  flex-shrink: 0;
  margin: 0;
  padding: 10px 16px;
  background: #fef3c7;
  border-bottom: 1px solid #f59e0b;
  color: #92400e;
  font-size: 13px;
  line-height: 1.4;
}

.factor-warning ul {
  margin: 6px 0 0 0;
  padding-left: 18px;
}

.factor-warning li {
  margin: 2px 0;
}

.summary-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #94a3b8;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f8fafc;
}

.summary-co2 .summary-value {
  color: #fb923c;
}

.summary-needs .summary-value {
  color: #4ade80;
}

.summary-leisure .summary-value {
  color: #e879f9;
}

.header-results-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  border: none;
  border-left: 1px solid #1e293b;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.header-results-button:hover {
  background: #1e293b;
  color: #ffffff;
}

.header-results-button .button-icon {
  font-size: 22px;
  line-height: 1;
}

.canvas-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.canvas-wrapper {
  flex: 1;
  background: #f1f5f9;
  overflow: hidden;
  min-width: 0; /* Allows flex item to shrink below content size */
  position: relative;
}

.value-slider-container {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  min-width: 120px;
}

.slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.slider-label {
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
}

.slider-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  font-size: 18px;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.slider-close:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.vertical-slider {
  writing-mode: bt-lr; /* IE */
  -webkit-appearance: slider-vertical; /* WebKit */
  appearance: slider-vertical; /* Standard */
  width: 8px;
  height: 200px;
  padding: 0 5px;
  cursor: pointer;
}

.vertical-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.vertical-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.slider-value-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 60px;
}

.slider-value {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.slider-min-max {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #6b7280;
}

.slider-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.set-null-button {
  width: 100%;
  padding: 8px 12px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  transition: all 0.2s ease;
}

.set-null-button:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  font-size: 24px;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.modal-body {
  padding: 24px;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.solver-result {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
  background: #f9fafb;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  flex: 1;
  overflow-y: auto;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6b7280;
  font-size: 14px;
}
</style>
