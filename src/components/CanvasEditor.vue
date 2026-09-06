<template>
  <div class="canvas-container">
    <header class="summary-header">
      <button
        class="header-status"
        :class="`header-status--${solverStatus.kind}`"
        :title="solverStatus.label"
        :aria-label="solverStatus.label"
        @click="handleResultsClick"
      >
        <i class="mdi" :class="solverStatus.icon"></i>
      </button>
      <label class="header-objective" :class="{ 'header-objective--disabled': isSolving }">
        <span class="summary-label">Solve for</span>
        <select
          class="header-objective-select"
          v-model="solverObjective"
          :disabled="isSolving"
          aria-label="Solve for"
        >
          <option
            v-for="option in solverObjectiveOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
      <div class="header-politics-wrap">
        <button
          class="header-politics"
          type="button"
          title="Policy: sum-node mix weights"
          aria-label="Policy: sum-node mix weights"
          :aria-expanded="showPoliticsPanel"
          @click="showPoliticsPanel = !showPoliticsPanel; showFactorsPanel = false"
        >
          <i class="mdi mdi-bank"></i>
        </button>
        <div v-if="showPoliticsPanel" class="politics-panel" @click.stop>
          <div class="politics-panel-header">
            <span>Policy mixes</span>
            <button type="button" class="politics-close" @click="showPoliticsPanel = false">
              <i class="mdi mdi-close"></i>
            </button>
          </div>
          <div class="politics-panel-body">
            <div v-for="group in sumNodePolicies" :key="group.id" class="politics-group">
              <div class="politics-group-title">{{ group.label }}</div>
              <div
                v-for="addon in group.addons"
                :key="addon.id"
                class="politics-addon"
                :class="{ 'politics-addon--free': addon.isNull }"
              >
                <div class="politics-addon-top">
                  <span class="politics-addon-label">{{ addon.label }}</span>
                  <span class="politics-addon-value">
                    {{
                      addon.isNull
                        ? 'free'
                        : politicsSliderDisplay(group.id, addon.id, addon.weight).toFixed(2)
                    }}
                  </span>
                  <button
                    type="button"
                    class="politics-lock"
                    :title="addon.isNull ? 'Unlocked (free / null) — click to lock' : 'Locked — click to unlock'"
                    :aria-label="addon.isNull ? 'Unlock weight' : 'Lock weight'"
                    :disabled="isSolving || policyChart?.running"
                    @click="toggleAddonLock(group.id, addon.id)"
                  >
                    <i class="mdi" :class="addon.isNull ? 'mdi-lock-open-variant' : 'mdi-lock'"></i>
                  </button>
                  <button
                    type="button"
                    class="politics-chart"
                    title="Sweep this policy 0→1 and plot the solve-for objective"
                    aria-label="Plot policy sensitivity"
                    :disabled="isSolving || policyChart?.running"
                    @click="runPolicySensitivity(group.id, addon.id, addon.label)"
                  >
                    <i class="mdi mdi-chart-line"></i>
                  </button>
                </div>
                <input
                  class="politics-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :disabled="addon.isNull || policyChart?.running"
                  :value="politicsSliderDisplay(group.id, addon.id, addon.isNull ? 0 : addon.weight)"
                  @input="(e) => onPoliticsSliderInput(group.id, addon.id, e)"
                  @change="(e) => onPoliticsSliderCommit(group.id, addon.id, e)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="header-politics-wrap">
        <button
          class="header-politics"
          type="button"
          title="TRE factors ledger & calibration"
          aria-label="TRE factors ledger and calibration"
          :aria-expanded="showFactorsPanel"
          @click="showFactorsPanel = !showFactorsPanel; showPoliticsPanel = false"
        >
          <i class="mdi mdi-tune-vertical"></i>
        </button>
        <div v-if="showFactorsPanel" class="politics-panel factors-panel" @click.stop>
          <div class="politics-panel-header">
            <span>Factors</span>
            <button type="button" class="politics-close" @click="showFactorsPanel = false">
              <i class="mdi mdi-close"></i>
            </button>
          </div>
          <div class="factors-panel-actions">
            <p class="factors-hint">
              <code>match_targets</code> does <strong>not</strong> change factors — only mixes and
              T values. Open this panel to inspect every TRE factor. Click
              <strong>Calibrate factors</strong> to lock reality mix targets in Policy and nudge
              factor values; changed rows highlight, and <strong>Copy JSON</strong> exports them.
            </p>
            <div class="factors-action-row">
              <button
                type="button"
                class="factors-btn"
                :disabled="isSolving || factorCalibrating"
                @click="runFactorCalibration"
              >
                {{ factorCalibrating ? 'Calibrating…' : 'Calibrate factors' }}
              </button>
              <button
                type="button"
                class="factors-btn factors-btn--ghost"
                :disabled="!factorBaseline || isSolving || factorCalibrating"
                @click="resetFactorsToBaseline"
              >
                Reset baseline
              </button>
              <button
                type="button"
                class="factors-btn factors-btn--ghost"
                :disabled="isSolving || factorCalibrating"
                @click="copyFactorsJson"
              >
                Copy JSON
              </button>
            </div>
            <p v-if="factorCalibStatus" class="factors-status">{{ factorCalibStatus }}</p>
          </div>
          <div class="politics-panel-body factors-table-wrap">
            <table class="factors-table">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Input</th>
                  <th>Value</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in factorLedgerRows"
                  :key="`${row.nodeId}|${row.inputId}`"
                  :class="{ 'factors-row--changed': Math.abs(row.delta) > 1e-9 }"
                  :title="row.comment || undefined"
                >
                  <td>{{ row.nodeId }}</td>
                  <td>{{ row.inputId }}</td>
                  <td class="factors-num">{{ row.current.toFixed(4) }}</td>
                  <td class="factors-num">
                    {{ Math.abs(row.delta) > 1e-9 ? (row.delta >= 0 ? '+' : '') + row.delta.toFixed(4) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="summary-center">
        <div class="summary-metric summary-co2">
          <span class="summary-label">CO₂</span>
          <span class="summary-value">{{ formatSummary(summaryTotals.co2) }}</span>
        </div>
        <div class="summary-metric summary-needs">
          <span class="summary-label">Basic Needs</span>
          <span class="summary-value">{{ formatSummary(summaryTotals.basicNeeds) }}</span>
        </div>
        <div class="summary-metric summary-leisure">
          <span class="summary-label">Leisure</span>
          <span class="summary-value">{{ formatSummary(summaryTotals.leisure) }}</span>
        </div>
        <div class="summary-metric summary-freetime">
          <span class="summary-label">Free Time</span>
          <span class="summary-value">{{ formatSummary(summaryTotals.freeTime) }}</span>
        </div>
        <div class="summary-metric summary-eroi12">
          <span class="summary-label">EROI 12</span>
          <span class="summary-value">{{ formatSummary(bandErois.eroi12) }}</span>
        </div>
        <div class="summary-metric summary-eroi123">
          <span class="summary-label">EROI 123</span>
          <span class="summary-value">{{ formatSummary(bandErois.eroi123) }}</span>
        </div>
        <div class="summary-metric summary-eroi23">
          <span class="summary-label">EROI 23</span>
          <span class="summary-value">{{ formatSummary(bandErois.eroi23) }}</span>
        </div>
      </div>
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
              v-for="divider in levelBandDividers"
              :key="divider.id"
              :config="divider.config"
              :listening="false"
            />
            <v-text
              v-for="title in levelBandTitles"
              :key="title.id"
              :config="title.config"
              :listening="false"
            />
            <v-line
              v-for="connector in connectors"
              :key="connector.id"
              :config="{
                points: connector.points,
                stroke: connector.color,
                strokeWidth: connector.strokeWidth - 1.2,
                lineCap: 'square',
                lineJoin: 'square',
                opacity: selectedConnectorId === connector.id ? 0.8 : 0.6,
                // Fat ribbons make Konva's default hit-canvas enormous; keep a thin pick target.
                hitStrokeWidth: 12,
                perfectDrawEnabled: false,
                shadowForStrokeEnabled: false
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
                perfectDrawEnabled: false,
                shadowEnabled: false,
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

    <!-- Policy sensitivity chart -->
    <div v-if="policyChart" class="modal-overlay" @click="closePolicyChart">
      <div class="modal-content policy-chart-modal" @click.stop>
        <div class="modal-header">
          <h2>
            {{ policyChart.yLabel }} vs {{ policyChart.xLabel }}
            <span v-if="policyChart.running" class="policy-chart-status">Computing…</span>
          </h2>
          <button class="modal-close" @click="closePolicyChart" :disabled="policyChart.running">
            <i class="mdi mdi-close"></i>
          </button>
        </div>
        <div class="modal-body policy-chart-body">
          <svg
            class="policy-chart-svg"
            :viewBox="`0 0 ${policyChartSvg.width} ${policyChartSvg.height}`"
            role="img"
            :aria-label="`${policyChart.yLabel} against ${policyChart.xLabel}`"
          >
            <rect
              :x="policyChartSvg.pad.l"
              :y="policyChartSvg.pad.t"
              :width="policyChartSvg.plotW"
              :height="policyChartSvg.plotH"
              class="policy-chart-plot-bg"
            />
            <g v-for="(tick, i) in policyChartSvg.yTicks" :key="'y' + i">
              <line
                :x1="policyChartSvg.pad.l"
                :x2="policyChartSvg.pad.l + policyChartSvg.plotW"
                :y1="tick.y"
                :y2="tick.y"
                class="policy-chart-grid"
              />
              <text :x="policyChartSvg.pad.l - 8" :y="tick.y + 4" class="policy-chart-axis-label" text-anchor="end">
                {{ tick.label }}
              </text>
            </g>
            <g v-for="(tick, i) in policyChartSvg.xTicks" :key="'x' + i">
              <line
                :x1="tick.x"
                :x2="tick.x"
                :y1="policyChartSvg.pad.t"
                :y2="policyChartSvg.pad.t + policyChartSvg.plotH"
                class="policy-chart-grid"
              />
              <text
                :x="tick.x"
                :y="policyChartSvg.pad.t + policyChartSvg.plotH + 18"
                class="policy-chart-axis-label"
                text-anchor="middle"
              >
                {{ tick.label }}
              </text>
            </g>
            <polyline
              v-for="(seg, i) in policyChartSvg.polylines"
              :key="'seg' + i"
              :points="seg"
              class="policy-chart-line"
              fill="none"
            />
            <circle
              v-for="(p, i) in policyChartSvg.points"
              :key="'p' + i"
              :cx="p.cx"
              :cy="p.cy"
              r="3.5"
              class="policy-chart-dot"
            />
            <g v-for="(miss, i) in policyChartSvg.noSolution" :key="'ns' + i">
              <line
                :x1="miss.x"
                :x2="miss.x"
                :y1="policyChartSvg.pad.t"
                :y2="policyChartSvg.pad.t + policyChartSvg.plotH"
                class="policy-chart-nosol-line"
              />
              <text
                :x="miss.x"
                :y="miss.labelY"
                class="policy-chart-nosol-label"
                text-anchor="middle"
                :transform="`rotate(-90 ${miss.x} ${miss.labelY})`"
              >
                No Solution
              </text>
            </g>
            <text
              :x="policyChartSvg.pad.l + policyChartSvg.plotW / 2"
              :y="policyChartSvg.height - 10"
              class="policy-chart-axis-title"
              text-anchor="middle"
            >
              {{ policyChart.xLabel }} (weight)
            </text>
            <text
              :x="16"
              :y="policyChartSvg.pad.t + policyChartSvg.plotH / 2"
              class="policy-chart-axis-title"
              text-anchor="middle"
              :transform="`rotate(-90 16 ${policyChartSvg.pad.t + policyChartSvg.plotH / 2})`"
            >
              {{ policyChart.yLabel }}
            </text>
          </svg>
          <p v-if="!policyChart.points.length && policyChart.running" class="loading">
            Sweeping policy weight 0 → 1…
          </p>
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
import { getStoredSolverResult, formatSolverResult, getSolverStatusInfo, outputMapSolver } from '../types/outputMapSolver'
import type { EnergyNode } from '../types/energyNode'
import {
  NodeType,
  nodesConfig,
  NodeConfig,
  getFactorSumFailures,
  factorsToJsonShape,
  snapshotFactors,
  restoreFactors
} from '../types/nodesConfig'
import {
  calibrateFactorsToTargets,
  diffAgainstBaseline,
  type FactorDiff
} from '../types/factorCalibration'

const SUMMARY_HEADER_HEIGHT = 56

const energyGraph = ref<EnergyGraphDrawer | undefined>(undefined)
const solverObjective = ref<SolverObjective>('maximize_leisure')
const solverObjectiveOptions: { value: SolverObjective; label: string }[] = [
  { value: 'maximize_leisure', label: 'Maximize Leisure' },
  { value: 'maximize_free_time', label: 'Maximize Free Time' },
  { value: 'minimize_co2', label: 'Minimize CO₂' },
  { value: 'match_targets', label: 'Match Reality Targets' }
]
const isSolving = ref(false)
const stageRef = ref<any>(null)
const showPoliticsPanel = ref(false)
const showFactorsPanel = ref(false)
/** Bumped when addon weights / factors change so panels refresh. */
const politicsTick = ref(0)
const factorsTick = ref(0)

const factorBaseline = ref<Record<string, number> | null>(snapshotFactors())
const factorCalibrating = ref(false)
const factorCalibStatus = ref('')

const factorLedgerRows = computed((): FactorDiff[] => {
  void factorsTick.value
  void energyGraph.value
  const baseline = factorBaseline.value ?? snapshotFactors()
  return diffAgainstBaseline(baseline)
})

async function runFactorCalibration() {
  if (factorCalibrating.value || isSolving.value) return
  factorCalibrating.value = true
  factorCalibStatus.value = 'Running outer-loop factor search…'
  try {
    if (!factorBaseline.value) {
      factorBaseline.value = snapshotFactors()
    }
    const result = await calibrateFactorsToTargets({
      innerObjective: 'maximize_free_time',
      rounds: 5,
      onProgress: (msg) => {
        factorCalibStatus.value = msg
      }
    })
    factorsTick.value++
    politicsTick.value++
    factorCalibStatus.value = `Done: score ${result.scoreBefore.toFixed(4)} → ${result.scoreAfter.toFixed(4)} (${result.diffs.length} factors changed, ${result.evaluations} solves)${result.shareLocksApplied ? ' · mix targets locked in Policy' : ''}`
    await regenerateGraph({ quiet: false })
  } catch (err) {
    factorCalibStatus.value = err instanceof Error ? err.message : String(err)
  } finally {
    factorCalibrating.value = false
  }
}

async function resetFactorsToBaseline() {
  if (!factorBaseline.value) return
  restoreFactors(factorBaseline.value)
  factorsTick.value++
  politicsTick.value++
  factorCalibStatus.value = 'Restored literature / baseline factors'
  await regenerateGraph({ quiet: true })
}

async function copyFactorsJson() {
  const payload = JSON.stringify(factorsToJsonShape(), null, 2)
  try {
    await navigator.clipboard.writeText(payload)
    factorCalibStatus.value = 'Copied current factors JSON to clipboard'
  } catch {
    factorCalibStatus.value = 'Clipboard failed — see console'
    console.log(payload)
  }
}

const selectedSquareIds = ref<Set<string>>(new Set())
const selectedConnectorId = ref<string | null>(null)
const clickedOnElement = ref<boolean>(false)

// Window dimensions
const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)

// Pan state — keep pointer tracking off the Vue reactivity path so pan/zoom
// doesn't re-render every Konva config object each frame.
const isPanning = ref<boolean>(false)
let lastPointerPosition: { x: number; y: number } | null = null
let panRafId: number | null = null
let zoomRafId: number | null = null
let pendingWheelEvent: WheelEvent | null = null

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

  // Keep level-band titles in view when fitting.
  const bands = levelBandLayout.value
  if (bands) {
    minY = Math.min(minY, bands.titleY)
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

const regenerateGraph = async (options?: { quiet?: boolean; preserveView?: boolean }) => {
  if (!options?.quiet) isSolving.value = true
  try {
    energyGraph.value = await generateEnergyGraph(solverObjective.value)
    if (!options?.quiet) {
      selectedSquareIds.value.clear()
      selectedConnectorId.value = null
    }
    await nextTick()
    if (!options?.preserveView) {
      requestAnimationFrame(() => fitGraphToView())
    }
  } finally {
    if (!options?.quiet) isSolving.value = false
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
        nodeConfig.co2,
        nodeConfig.endUse,
        nodeConfig.residualOf,
        nodeConfig.factorComments
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
        nodeConfig.co2,
        nodeConfig.endUse,
        nodeConfig.residualOf,
        nodeConfig.factorComments
      )
    }
  }

  factorsTick.value++

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
  await setAddonWeight(node.id, nodeType, null)
}

function cleanLabel(label: string): string {
  return label.replace(/\s*\n\s*/g, ' ').trim()
}

const sumNodePolicies = computed(() => {
  void energyGraph.value
  void politicsTick.value
  return nodesConfig.nodes
    .filter((n) => Object.keys(n.addons).length > 0)
    .map((sum) => ({
      id: sum.id,
      label: cleanLabel(sum.label),
      addons: Object.entries(sum.addons).map(([addonId, weight]) => {
        const addonNode = nodesConfig.nodes.find((n) => n.id === addonId)
        return {
          id: addonId as NodeType,
          label: cleanLabel(addonNode?.label ?? addonId),
          weight: weight ?? null,
          isNull: weight === null || weight === undefined
        }
      })
    }))
})

async function setAddonWeight(
  sumId: string,
  addonId: NodeType,
  value: number | null,
  options?: { quiet?: boolean; preserveView?: boolean }
) {
  applyAddonWeightConfig(sumId, addonId, value)
  politicsTick.value++
  await regenerateGraph({
    quiet: options?.quiet,
    preserveView: options?.preserveView ?? options?.quiet
  })
}

function applyAddonWeightConfig(sumId: string, addonId: NodeType, value: number | null) {
  const nodeConfig = nodesConfig.nodes.find((n) => n.id === sumId)
  if (!nodeConfig) return

  const newAddons = { ...nodeConfig.addons, [addonId]: value }
  const index = nodesConfig.nodes.findIndex((n) => n.id === sumId)
  if (index === -1) return

  nodesConfig.nodes[index] = new NodeConfig(
    nodeConfig.id,
    nodeConfig.label,
    nodeConfig.level,
    nodeConfig.color,
    nodeConfig.factors,
    newAddons,
    nodeConfig.minOutput,
    nodeConfig.co2,
    nodeConfig.endUse,
    nodeConfig.residualOf,
    nodeConfig.factorComments
  )
}

async function toggleAddonLock(sumId: string, addonId: NodeType) {
  const sum = nodesConfig.nodes.find((n) => n.id === sumId)
  if (!sum) return
  const current = sum.addons[addonId]
  if (current === null || current === undefined) {
    // Lock at a neutral share; user can fine-tune with the slider.
    await setAddonWeight(sumId, addonId, 0.5)
  } else {
    await setAddonWeight(sumId, addonId, null)
  }
}

type PolicyChartPoint = { x: number; y: number | null }

type PolicyChartState = {
  running: boolean
  xLabel: string
  yLabel: string
  /** Fixed Y-axis max: 2 for minimize CO₂, otherwise 1. */
  yMax: number
  points: PolicyChartPoint[]
}

const policyChart = ref<PolicyChartState | null>(null)

function closePolicyChart() {
  if (policyChart.value?.running) return
  policyChart.value = null
}

const policyChartSvg = computed(() => {
  const width = 720
  const height = 420
  const pad = { t: 24, r: 24, b: 56, l: 64 }
  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b
  const pts = policyChart.value?.points ?? []
  const y0 = 0
  const y1 = policyChart.value?.yMax ?? 1

  const xTo = (x: number) => pad.l + (x / 1) * plotW
  const yTo = (y: number) => pad.t + plotH - ((y - y0) / (y1 - y0 || 1)) * plotH

  const mapped = pts
    .filter((p): p is { x: number; y: number } => p.y !== null && Number.isFinite(p.y))
    .map((p) => ({ cx: xTo(p.x), cy: yTo(p.y), x: p.x, y: p.y }))

  // Break the line wherever the solver failed so zeros aren't drawn across gaps.
  const polylines: string[] = []
  let segment: string[] = []
  for (const p of pts) {
    if (p.y !== null && Number.isFinite(p.y)) {
      segment.push(`${xTo(p.x)},${yTo(p.y)}`)
    } else if (segment.length) {
      polylines.push(segment.join(' '))
      segment = []
    }
  }
  if (segment.length) polylines.push(segment.join(' '))

  const noSolution = pts
    .filter((p) => p.y === null)
    .map((p) => ({
      x: xTo(p.x),
      labelY: pad.t + plotH / 2
    }))

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((x) => ({
    x: xTo(x),
    label: x.toFixed(2)
  }))
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const t = y0 + ((y1 - y0) * i) / 4
    return { y: yTo(t), label: formatSummary(t) }
  })

  return {
    width,
    height,
    pad,
    plotW,
    plotH,
    points: mapped,
    polylines,
    noSolution,
    xTicks,
    yTicks
  }
})

async function runPolicySensitivity(sumId: string, addonId: NodeType, addonLabel: string) {
  if (policyChart.value?.running || isSolving.value) return

  const sum = nodesConfig.nodes.find((n) => n.id === sumId)
  if (!sum) return

  const previous =
    sum.addons[addonId] === undefined ? null : (sum.addons[addonId] as number | null)
  const yLabel =
    solverObjectiveOptions.find((o) => o.value === solverObjective.value)?.label ??
    solverObjective.value
  const yMax = solverObjective.value === 'minimize_co2' ? 2 : 1

  policyChart.value = {
    running: true,
    xLabel: addonLabel,
    yLabel,
    yMax,
    points: []
  }
  isSolving.value = true

  try {
    for (let i = 0; i <= 20; i++) {
      const weight = Math.round(i * 0.05 * 100) / 100
      applyAddonWeightConfig(sumId, addonId, weight)
      await outputMapSolver(nodesConfig, solverObjective.value)
      const result = getStoredSolverResult()
      const statusInfo = getSolverStatusInfo(result)
      const z = result?.result?.z
      const solved =
        statusInfo.kind === 'success' ||
        (statusInfo.kind === 'warning' && statusInfo.label.startsWith('Feasible'))
      policyChart.value.points.push({
        x: weight,
        y: solved && typeof z === 'number' && Number.isFinite(z) ? z : null
      })
      // Refresh chart progressively.
      policyChart.value = {
        ...policyChart.value,
        points: [...policyChart.value.points]
      }
      await nextTick()
    }
  } finally {
    applyAddonWeightConfig(sumId, addonId, previous)
    politicsTick.value++
    try {
      await regenerateGraph()
    } finally {
      isSolving.value = false
      if (policyChart.value) {
        policyChart.value = { ...policyChart.value, running: false }
      }
    }
  }
}

/** Local slider drafts so the thumb tracks the mouse while solves catch up. */
const politicsSliderDrafts = ref<Record<string, number>>({})
let politicsSliderTimeout: ReturnType<typeof setTimeout> | null = null
let politicsSliderSeq = 0

function politicsSliderKey(sumId: string, addonId: NodeType) {
  return `${sumId}:${addonId}`
}

function roundPolicyWeight(value: number) {
  return Math.round(value * 100) / 100
}

function politicsSliderDisplay(sumId: string, addonId: NodeType, weight: number | null | undefined) {
  const key = politicsSliderKey(sumId, addonId)
  if (Object.prototype.hasOwnProperty.call(politicsSliderDrafts.value, key)) {
    return politicsSliderDrafts.value[key]
  }
  return weight ?? 0
}

function schedulePoliticsSliderSolve(sumId: string, addonId: NodeType, value: number) {
  const key = politicsSliderKey(sumId, addonId)
  if (politicsSliderTimeout) clearTimeout(politicsSliderTimeout)
  const seq = ++politicsSliderSeq
  politicsSliderTimeout = setTimeout(async () => {
    politicsSliderTimeout = null
    await setAddonWeight(sumId, addonId, value, { quiet: true, preserveView: true })
    // Drop draft only if the user hasn't moved further.
    if (seq === politicsSliderSeq && politicsSliderDrafts.value[key] === value) {
      const next = { ...politicsSliderDrafts.value }
      delete next[key]
      politicsSliderDrafts.value = next
    }
  }, 40)
}

function onPoliticsSliderInput(sumId: string, addonId: NodeType, event: Event) {
  const value = roundPolicyWeight(parseFloat((event.target as HTMLInputElement).value) || 0)
  politicsSliderDrafts.value = {
    ...politicsSliderDrafts.value,
    [politicsSliderKey(sumId, addonId)]: value
  }
  schedulePoliticsSliderSolve(sumId, addonId, value)
}

async function onPoliticsSliderCommit(sumId: string, addonId: NodeType, event: Event) {
  const key = politicsSliderKey(sumId, addonId)
  const value = roundPolicyWeight(parseFloat((event.target as HTMLInputElement).value) || 0)
  politicsSliderDrafts.value = {
    ...politicsSliderDrafts.value,
    [key]: value
  }
  if (politicsSliderTimeout) {
    clearTimeout(politicsSliderTimeout)
    politicsSliderTimeout = null
  }
  const seq = ++politicsSliderSeq
  await setAddonWeight(sumId, addonId, value, { quiet: true, preserveView: true })
  if (seq === politicsSliderSeq) {
    const next = { ...politicsSliderDrafts.value }
    delete next[key]
    politicsSliderDrafts.value = next
  }
}

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const nodes = computed(() => {
  return energyGraph.value?.nodes || []
})

/** Visual bands from nodes.json (`levelBands`). */
const LEVEL_TITLE_GAP = 48
const LEVEL_TITLE_FONT_SIZE = 20

/** Map each energy node id → 0-based levelBand index (heat/dump excluded). */
function nodeBandIndexById(
  graph: EnergyGraphDrawer
): Map<string, number> {
  const map = new Map<string, number>()
  nodesConfig.levelBands.forEach((band, bandIndex) => {
    for (const node of graph.energyNodes) {
      if (band.levels.includes(node.level.id)) map.set(node.id, bandIndex)
    }
  })
  return map
}

/**
 * Useful (non-heat) power crossing between levelBands.
 * `flows[i][j]` = total outputMap power from nodes in band i+1 to nodes in band j+1.
 * Same-band and heat dumps are excluded; not part of the GLPK model.
 */
function computeInterBandUsefulFlows(graph: EnergyGraphDrawer): number[][] {
  const bandCount = nodesConfig.levelBands.length
  const flows = Array.from({ length: bandCount }, () => Array(bandCount).fill(0))
  const bandOf = nodeBandIndexById(graph)

  for (const source of graph.energyNodes) {
    const from = bandOf.get(source.id)
    if (from === undefined) continue

    for (const [targetId, power] of Object.entries(source.outputMap)) {
      if (!power) continue
      if (targetId === 'heat') continue
      const to = bandOf.get(targetId)
      if (to === undefined || to === from) continue
      flows[from][to] += power
    }
  }

  return flows
}

/** EROI metrics from inter-band useful flows (t_ij). */
function computeBandErois(flows: number[][]) {
  const t12 = flows[0]?.[1] ?? 0
  const t13 = flows[0]?.[2] ?? 0
  const t21 = flows[1]?.[0] ?? 0
  const t23 = flows[1]?.[2] ?? 0
  const t31 = flows[2]?.[0] ?? 0
  const t32 = flows[2]?.[1] ?? 0
  const out1 = t12 + t13
  const backTo1 = t21 + t31
  const into3 = t13 + t23
  const outOf3 = t31 + t32
  return {
    /** (t12 + t13) / t21 */
    eroi12: t21 > 0 ? out1 / t21 : Number.POSITIVE_INFINITY,
    /** (t12 + t13) / (t21 + t31) */
    eroi123: backTo1 > 0 ? out1 / backTo1 : Number.POSITIVE_INFINITY,
    /** (t13 + t23) / (t31 + t32) */
    eroi23: outOf3 > 0 ? into3 / outOf3 : Number.POSITIVE_INFINITY
  }
}

/** Vertical segment kinds in a column corridor (see EnergyGraphDrawer.createConnector). */
function classifyCorridorVertical(
  pointCount: number,
  segmentIndex: number
): 'forward' | 'backward' | null {
  // dump: 3 points → one exit vertical
  if (pointCount === 3) return 'forward'
  // bus: 6 points → seg 1 exit (forward), seg 3 approach (backward)
  if (pointCount === 6) {
    if (segmentIndex === 1) return 'forward'
    if (segmentIndex === 3) return 'backward'
    return null
  }
  // middle with a vertical: 4 points → packs from the approach side
  if (pointCount === 4) return 'backward'
  return null
}

/**
 * X of the empty strip between forward exit/dump verticals and backward
 * approach/middle verticals in the corridor between two column faces.
 */
function corridorGapMidX(
  connectors: { points: number[]; strokeWidth: number; power: number }[],
  leftFace: number,
  rightFace: number
): number {
  let forwardMax = leftFace
  let backwardMin = rightFace

  for (const c of connectors) {
    if (!c.power) continue
    const half = c.strokeWidth / 2
    const p = c.points
    const nPts = p.length / 2

    for (let k = 0; k < nPts - 1; k++) {
      const x0 = p[2 * k]
      const y0 = p[2 * k + 1]
      const x1 = p[2 * k + 2]
      const y1 = p[2 * k + 3]
      const vertical = Math.abs(x0 - x1) < 0.5 && Math.abs(y0 - y1) > 0.5
      if (!vertical) continue
      if (x0 <= leftFace + 0.5 || x0 >= rightFace - 0.5) continue

      const kind = classifyCorridorVertical(nPts, k)
      if (kind === 'forward') forwardMax = Math.max(forwardMax, x0 + half)
      if (kind === 'backward') backwardMin = Math.min(backwardMin, x0 - half)
    }
  }

  if (backwardMin > forwardMax) return (forwardMax + backwardMin) / 2
  // Fallback when a corridor has no clear forward/backward split.
  return (leftFace + rightFace) / 2
}

const levelBandLayout = computed(() => {
  const graph = energyGraph.value
  if (!graph) return null

  const bands = nodesConfig.levelBands
    .map((band) => {
      const bandNodes = graph.energyNodes.filter((n) => band.levels.includes(n.level.id))
      if (!bandNodes.length) return null
      return {
        id: band.id,
        label: band.label,
        minX: Math.min(...bandNodes.map((n) => n.x)),
        maxX: Math.max(...bandNodes.map((n) => n.x + n.width))
      }
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)

  if (bands.length < 2) return null

  const allNodes = graph.nodes
  let contentTop = Math.min(...allNodes.map((n) => n.y))
  const maxY = Math.max(...allNodes.map((n) => n.y + n.height))

  // Titles/dividers must sit above the highest connector ribbon, not just nodes.
  for (const c of graph.connectors) {
    if (!c.power) continue
    const half = c.strokeWidth / 2
    for (let i = 1; i < c.points.length; i += 2) {
      contentTop = Math.min(contentTop, c.points[i] - half)
    }
  }

  const titleY = contentTop - LEVEL_TITLE_GAP

  const dividerXs: number[] = []
  for (let i = 0; i < bands.length - 1; i++) {
    dividerXs.push(
      corridorGapMidX(graph.connectors, bands[i].maxX, bands[i + 1].minX)
    )
  }

  const dividers = dividerXs.map((x, i) => ({
    id: `level-divider-${bands[i].id}-${bands[i + 1].id}`,
    config: {
      points: [x, titleY, x, maxY],
      stroke: '#94a3b8',
      strokeWidth: 1,
      opacity: 0.75,
      listening: false
    }
  }))

  const titles = bands.map((band, i) => {
    const left = i === 0 ? band.minX : dividerXs[i - 1]
    const right = i === dividerXs.length ? band.maxX : dividerXs[i]
    const span = Math.max(40, right - left)
    const labelWidth = Math.max(span, band.label.length * LEVEL_TITLE_FONT_SIZE * 0.58)
    const centerX = (left + right) / 2
    return {
      id: `level-title-${band.id}`,
      config: {
        x: centerX - labelWidth / 2,
        y: titleY,
        width: labelWidth,
        text: band.label,
        fontSize: LEVEL_TITLE_FONT_SIZE,
        fontFamily: 'Arial',
        fill: '#64748b',
        align: 'center',
        listening: false
      }
    }
  })

  return { dividers, titles, titleY }
})

const levelBandDividers = computed(() => levelBandLayout.value?.dividers ?? [])
const levelBandTitles = computed(() => levelBandLayout.value?.titles ?? [])

function isLightFill(color: string): boolean {
  const hex = color.replace('#', '').slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 180
}

function buildNodeLabelConfig(square: {
  id: string
  label: string
  color: string
  x: number
  y: number
  width: number
  height: number
}) {
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
  const light = isLightFill(square.color)

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
      fontStyle: light ? 'bold' : 'normal',
      fill: light ? '#1e293b' : '#ffffff',
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
  if (value > 1e6) return '∞'
  if (value < 0.001) return value.toExponential(2)
  return value.toFixed(3)
}

const summaryTotals = computed(() => {
  // Depend on energyGraph so values refresh after each solve.
  void energyGraph.value
  const vars = getStoredSolverResult()?.result?.vars
  return {
    co2: vars?.['T:co2'] ?? 0,
    basicNeeds: vars?.['T:basicNeeds'] ?? 0,
    leisure: vars?.['T:leisure'] ?? 0,
    freeTime: vars?.['T:freeTime'] ?? 0
  }
})

const bandErois = computed(() => {
  const graph = energyGraph.value
  if (!graph) return { eroi12: Number.NaN, eroi123: Number.NaN, eroi23: Number.NaN }
  return computeBandErois(computeInterBandUsefulFlows(graph))
})

/** Recompute when the graph regenerates (config/slider edits rebuild nodesConfig entries). */
const factorSumWarnings = computed(() => {
  void energyGraph.value
  return getFactorSumFailures(nodesConfig.nodes)
})

const solverStatus = computed(() => {
  // Re-read after each solve (graph rebuild stores a new result).
  void energyGraph.value
  void isSolving.value
  if (isSolving.value) {
    return { kind: 'pending' as const, label: 'Solving…', icon: 'mdi-loading mdi-spin' }
  }
  return getSolverStatusInfo(getStoredSolverResult())
})

const handleWheel = (e: any) => {
  e.evt.preventDefault()
  pendingWheelEvent = e.evt as WheelEvent
  if (zoomRafId != null) return

  zoomRafId = requestAnimationFrame(() => {
    zoomRafId = null
    const evt = pendingWheelEvent
    pendingWheelEvent = null
    if (!evt) return

    const stage = stageRef.value?.getNode()
    if (!stage) return

    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    }

    let direction = evt.deltaY < 0 ? 1 : -1
    // Trackpad pinch-zoom sets ctrlKey; invert so the gesture feels natural.
    if (evt.ctrlKey) direction = -direction

    const scaleBy = 1.06
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    stage.scale({ x: newScale, y: newScale })
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    })
  })
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
      if (pointer) lastPointerPosition = { x: pointer.x, y: pointer.y }
    }
    event.evt.preventDefault()
  }
}

const applyPanFrame = () => {
  panRafId = null
  if (!isPanning.value || !lastPointerPosition) return

  const stage = stageRef.value?.getNode()
  if (!stage) return

  const pointer = stage.getPointerPosition()
  if (!pointer) return

  const dx = pointer.x - lastPointerPosition.x
  const dy = pointer.y - lastPointerPosition.y
  if (dx === 0 && dy === 0) return

  const currentPos = stage.position()
  stage.position({
    x: currentPos.x + dx,
    y: currentPos.y + dy
  })
  lastPointerPosition = { x: pointer.x, y: pointer.y }
}

const handleMouseMove = (_event: { evt: MouseEvent }) => {
  if (!isPanning.value || !lastPointerPosition) return
  if (panRafId != null) return
  panRafId = requestAnimationFrame(applyPanFrame)
}

const handleMouseUp = (event: { evt: MouseEvent }) => {
  if (event.evt.button === 1) {
    isPanning.value = false
    lastPointerPosition = null
    if (panRafId != null) {
      cancelAnimationFrame(panRafId)
      panRafId = null
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
  justify-content: flex-start;
  gap: 0;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
  z-index: 20;
}

.summary-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
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

.header-objective {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 0 16px;
  border-right: 1px solid #1e293b;
}

.header-objective--disabled {
  opacity: 0.6;
}

.header-politics-wrap {
  position: relative;
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  border-right: 1px solid #1e293b;
}

.header-politics {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: #e2e8f0;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.header-politics:hover,
.header-politics[aria-expanded='true'] {
  background: #1e293b;
  color: #ffffff;
}

.politics-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 40;
  width: min(360px, calc(100vw - 24px));
  max-height: min(70vh, 520px);
  display: flex;
  flex-direction: column;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.factors-panel {
  width: min(480px, calc(100vw - 24px));
  max-height: min(80vh, 640px);
}

.factors-panel-actions {
  padding: 10px 12px;
  border-bottom: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.factors-hint {
  margin: 0;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.45;
}

.factors-hint code {
  color: #cbd5e1;
  font-size: 10px;
}

.factors-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.factors-btn {
  border: none;
  border-radius: 4px;
  padding: 6px 10px;
  background: #2563eb;
  color: #f8fafc;
  font-size: 12px;
  cursor: pointer;
}

.factors-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.factors-btn--ghost {
  background: #1e293b;
  color: #e2e8f0;
}

.factors-status {
  margin: 0;
  color: #86efac;
  font-size: 11px;
  line-height: 1.4;
}

.factors-table-wrap {
  padding: 0;
}

.factors-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  color: #cbd5e1;
}

.factors-table th,
.factors-table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid #1e293b;
}

.factors-table th {
  position: sticky;
  top: 0;
  background: #0f172a;
  color: #94a3b8;
  font-weight: 600;
}

.factors-num {
  font-variant-numeric: tabular-nums;
  text-align: right !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.factors-row--changed {
  background: rgba(37, 99, 235, 0.18);
  color: #f8fafc;
}

.politics-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #1e293b;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
}

.politics-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.politics-close:hover {
  background: #1e293b;
  color: #ffffff;
}

.politics-panel-body {
  overflow-y: auto;
  padding: 8px 10px 12px;
}

.politics-group {
  padding: 8px 6px 10px;
  border-bottom: 1px solid #1e293b;
}

.politics-group:last-child {
  border-bottom: none;
}

.politics-group-title {
  margin-bottom: 8px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.politics-addon {
  padding: 8px 6px;
  border-radius: 6px;
}

.politics-addon--free {
  opacity: 0.72;
}

.politics-addon-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.politics-addon-label {
  flex: 1;
  min-width: 0;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
}

.politics-addon-value {
  color: #94a3b8;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.politics-lock {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: #1e293b;
  color: #fbbf24;
  font-size: 18px;
  cursor: pointer;
}

.politics-lock:hover {
  background: #243044;
}

.politics-addon--free .politics-lock {
  color: #94a3b8;
}

.politics-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: #1e293b;
  color: #38bdf8;
  font-size: 18px;
  cursor: pointer;
}

.politics-chart:hover:not(:disabled) {
  background: #243044;
}

.politics-chart:disabled,
.politics-lock:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.politics-slider {
  width: 100%;
  accent-color: #38bdf8;
  cursor: pointer;
}

.politics-slider:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.header-objective-select {
  appearance: none;
  background: #1e293b
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%94a3b8' d='M3 4.5L6 8l3-3.5'/%3E%3C/svg%3E")
    no-repeat right 8px center;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 4px 28px 4px 10px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  min-width: 160px;
}

.header-objective-select:hover:not(:disabled) {
  border-color: #475569;
  background-color: #243044;
}

.header-objective-select:focus {
  outline: none;
  border-color: #38bdf8;
}

.header-objective-select:disabled {
  cursor: not-allowed;
}

.header-objective-select option {
  background: #0f172a;
  color: #e2e8f0;
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

.summary-freetime .summary-value {
  color: #94a3b8;
}

.summary-eroi12 .summary-value {
  color: #38bdf8;
}

.summary-eroi123 .summary-value {
  color: #818cf8;
}

.summary-eroi23 .summary-value {
  color: #2dd4bf;
}

.header-status {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 56px;
  height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  border-right: 1px solid #1e293b;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease;
}

.header-status:hover {
  background: #1e293b;
}

.header-status--success {
  color: #4ade80;
}

.header-status--warning {
  color: #fbbf24;
}

.header-status--error {
  color: #f87171;
}

.header-status--pending {
  color: #94a3b8;
}

.header-status--unknown {
  color: #94a3b8;
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

.policy-chart-modal {
  max-width: 820px;
}

.policy-chart-status {
  margin-left: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
}

.policy-chart-body {
  padding: 12px 20px 24px;
}

.policy-chart-svg {
  width: 100%;
  height: auto;
  display: block;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.policy-chart-plot-bg {
  fill: #ffffff;
}

.policy-chart-grid {
  stroke: #e2e8f0;
  stroke-width: 1;
}

.policy-chart-line {
  stroke: #0284c7;
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.policy-chart-dot {
  fill: #0284c7;
}

.policy-chart-nosol-line {
  stroke: #f87171;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  opacity: 0.7;
}

.policy-chart-nosol-label {
  fill: #b91c1c;
  font-size: 10px;
  font-weight: 600;
  font-family: Arial, sans-serif;
}

.policy-chart-axis-label {
  fill: #64748b;
  font-size: 11px;
  font-family: Arial, sans-serif;
}

.policy-chart-axis-title {
  fill: #334155;
  font-size: 12px;
  font-weight: 600;
  font-family: Arial, sans-serif;
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
