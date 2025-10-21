<template>
  <div class="canvas-container">
    <div class="canvas-wrapper">
      <v-stage ref="stageRef" :config="stageConfig" @wheel="handleWheel" @click="handleStageClick" @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp">
        <v-layer>
          <v-line
            v-for="connector in connectors"
            :key="connector.id"
            :config="{
              points: connector.points,
              stroke: connector.color,
              strokeWidth: connector.strokeWidth,
              lineCap: 'round',
              lineJoin: 'round',
              opacity: selectedConnectorId === connector.id ? 0.9 : 0.4
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
              strokeWidth: 2,
              shadowBlur: 5,
              shadowColor: 'black',
              shadowOpacity: 0.2,
              opacity: selectedSquareIds.has(square.id) ? 0.6 : 1
            }"
            @click="(e: any) => handleSquareClick(square.id, e)"
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
              strokeWidth: 2,
              shadowBlur: 5,
              shadowColor: 'black',
              shadowOpacity: 0.2,
              opacity: selectedSquareIds.has(square.id) ? 0.8 : 1
            }"
            @click="(e: any) => handleSquareClick(square.id, e)"
          />

          <v-text
            v-for="square in nodes"
            :key="`text-${square.id}`"
            :config="{
              x: square.x + square.width / 2,
              y: square.y + square.height / 2,
              text: square.id,
              fontSize: 18,
              fontFamily: 'Arial',
              fill: '#ffffff',
              align: 'center',
              verticalAlign: 'middle',
              offsetX: square.id.length * 5,
              offsetY: 7,
              draggable: true
            }"
            @click="(e: any) => handleSquareClick(square.id, e)"
          />
        </v-layer>
      </v-stage>
    </div>
    <InfoPanel :selectedNodes="selectedSquares" :selectedConnector="selectedConnector" :energyGraph="energyGraph" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Connector, EnergyGraph } from '../types/energyGraph'
import InfoPanel from './InfoPanel.vue'
import getEnergyGraph from '../types/nodes'
import { onMounted } from 'vue'

const FPS_INTERVAL_IN_MS = 16

const energyGraph = ref<EnergyGraph | undefined>(undefined)
const stageRef = ref<any>(null)

const stageWidth = window.innerWidth - 350
const stageHeight = window.innerHeight


const selectedSquareIds = ref<Set<string>>(new Set())
const selectedConnectorId = ref<string | null>(null)
const clickedOnElement = ref<boolean>(false)

// Pan state
const isPanning = ref<boolean>(false)
const lastPointerPosition = ref<{ x: number; y: number } | null>(null)
const panTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

onMounted(async () => {
  energyGraph.value = await getEnergyGraph()
})


const nodes = computed(() => {
  return energyGraph.value?.nodes || []
})


const connectors = computed<Connector[]>(() => {
  return energyGraph.value?.generateFlowConnectors() || []
})

const selectedSquares = computed(() => {
  return nodes.value.filter((sq) => selectedSquareIds.value.has(sq.id))
})

const selectedConnector = computed((): Connector | null => {
  if (!selectedConnectorId.value) return null
  return connectors.value.find((conn) => conn.id === selectedConnectorId.value) || null
})



const stageConfig = computed(() => ({
  width: stageWidth,
  height: stageHeight
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

const handleConnectorClick = (connectorId: string, event: { evt: MouseEvent }) => {
  clickedOnElement.value = true
  selectedConnectorId.value = connectorId
  selectedSquareIds.value.clear() // Clear node selection
}

const handleStageClick = (event: { evt: MouseEvent }) => {
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

const handleMouseMove = (event: { evt: MouseEvent }) => {
  if (!isPanning.value || !lastPointerPosition.value) return
  
  // Clear existing timeout
  if (panTimeout.value) {
    clearTimeout(panTimeout.value)
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
</script>

<style scoped>
.canvas-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.canvas-wrapper {
  flex: 1;
  background: #f1f5f9;
  overflow: hidden;
}
</style>
