<template>
  <div class="canvas-container">
    <div class="canvas-wrapper">
      <!-- Control Buttons -->
      <div class="control-buttons">
        <button class="control-button" @click="handleSettingsClick" title="Settings">
          <i class="mdi mdi-cog button-icon"></i>
        </button>
        <button class="control-button" @click="handleResultsClick" title="Results">
          <i class="mdi mdi-notebook button-icon"></i>
        </button>
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
              strokeWidth: selectedSquareIds.has(square.id) ? 4 : 2,
              shadowBlur: 5,
              shadowColor: 'black',
              shadowOpacity: 0.2,
              opacity: 1
            }"
            @click="(e: any) => handleSquareClick(square.id, e)"
          />

          <v-text
            v-for="square in nodes"
            :key="`text-${square.id}`"
            :config="{
              x: square.x + square.width / 2,
              y: square.y + square.height / 2,
              text: square.label,
              fontSize: 18,
              fontFamily: 'Arial',
              fill: '#ffffff',
              align: 'center',
              verticalAlign: 'middle',
              offsetX: square.width / 2 - 10,
              offsetY: 10
            }"
            @click="(e: any) => handleSquareClick(square.id, e)"
          />
        </v-layer>
      </v-stage>
    </div>
    <InfoPanel
      v-if="isInfoPanelVisible"
      :selectedNodes="selectedSquares"
      :selectedConnector="selectedConnector"
      :energyGraph="energyGraph"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Connector, EnergyGraphDrawer } from '../types/energyGraphDrawer'
import InfoPanel from './InfoPanel.vue'
import generateEnergyGraph from '../types/energyGraphGenerator'
import { onMounted, onUnmounted } from 'vue'

const FPS_INTERVAL_IN_MS = 16

const energyGraph = ref<EnergyGraphDrawer | undefined>(undefined)
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

// Handle window resize
const handleResize = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
}

onMounted(async () => {
  energyGraph.value = await generateEnergyGraph()
  
  // Add resize listener
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

const nodes = computed(() => {
  return energyGraph.value?.nodes || []
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

// Calculate canvas dimensions - full width when panel is hidden, reduced when visible
const stageConfig = computed(() => ({
  width: isInfoPanelVisible.value ? windowWidth.value - 350 : windowWidth.value,
  height: windowHeight.value
}))

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

const handleSquareClick = (squareId: string, event: { evt: MouseEvent }) => {
  console.log(`Clicked on ${squareId}`)
  clickedOnElement.value = true
  // Clear connector selection when clicking on nodes
  selectedConnectorId.value = null

  if (event.evt.shiftKey) {
    if (selectedSquareIds.value.has(squareId)) {
      selectedSquareIds.value.delete(squareId)
    } else {
      selectedSquareIds.value.add(squareId)
    }
  } else {
    selectedSquareIds.value.clear()
    selectedSquareIds.value.add(squareId)
  }
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

const handleSettingsClick = () => {
  console.log('Settings clicked')
  // TODO: Implement settings functionality
}

const handleResultsClick = () => {
  console.log('Results clicked')
  // TODO: Implement results functionality
}
</script>

<style scoped>
.canvas-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.canvas-wrapper {
  flex: 1;
  background: #f1f5f9;
  overflow: hidden;
  min-width: 0; /* Allows flex item to shrink below content size */
  position: relative;
}

.control-buttons {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  padding: 0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  color: #334155;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  user-select: none;
}

.control-button:hover {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.control-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.button-icon {
  font-size: 24px;
  line-height: 1;
  transition: transform 0.2s ease;
}

.control-button:hover .button-icon {
  transform: scale(1.1);
}
</style>
