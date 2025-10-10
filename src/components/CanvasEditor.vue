<template>
  <div class="canvas-container">
    <div class="canvas-wrapper">
      <v-stage :config="{ width: stageWidth, height: stageHeight }">
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
              opacity:  selectedConnectorId === connector.id ? 0.9 : 0.4
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
              opacity: selectedSquareIds.has(square.id) ? 0.8 : 1
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
    <InfoPanel :selectedNodes="selectedSquares" :selectedConnector="selectedConnector" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Connector } from '../types/canvas';
import InfoPanel from './InfoPanel.vue';
import energyGraph from '../types/nodes';

const stageWidth = window.innerWidth - 350;
const stageHeight = window.innerHeight;

const nodes = energyGraph.nodes;

const selectedSquareIds = ref<Set<string>>(new Set());
const selectedConnectorId = ref<string | null>(null);

const connectors = computed<Connector[]>(() => {
  return energyGraph.generateFlowConnectors();
});

const selectedSquares = computed(() => {
  return nodes.filter(sq => selectedSquareIds.value.has(sq.id));
});

const selectedConnector = computed((): Connector | null => {
  if (!selectedConnectorId.value) return null;
  return connectors.value.find(conn => conn.id === selectedConnectorId.value) || null;
});

const handleSquareClick = (squareId: string, event: { evt: MouseEvent }) => {
  // Clear connector selection when clicking on nodes
  selectedConnectorId.value = null;
  
  if (event.evt.shiftKey) {
    if (selectedSquareIds.value.has(squareId)) {
      selectedSquareIds.value.delete(squareId);
    } else {
      selectedSquareIds.value.add(squareId);
    }
  } else {
    selectedSquareIds.value.clear();
    selectedSquareIds.value.add(squareId);
  }
};

const handleConnectorClick = (connectorId: string, event: { evt: MouseEvent }) => {
  event.evt.stopPropagation(); // Prevent node click
  selectedConnectorId.value = connectorId;
  selectedSquareIds.value.clear(); // Clear node selection
};

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
