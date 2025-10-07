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
              stroke: '#64748b',
              strokeWidth: 2,
              lineCap: 'round',
              lineJoin: 'round'
            }"
          />
          <v-rect
            v-for="square in nodes"
            :key="square.id"
            :config="{
              x: square.x,
              y: square.y,
              width: square.width,
              height: square.height,
              fill: getSquareFill(square.id),
              stroke: '#1e293b',
              strokeWidth: 2,
              shadowBlur: 5,
              shadowColor: 'black',
              shadowOpacity: 0.2,
            }"
            @click="(e: any) => handleSquareClick(square.id, e)"
          />
          <v-text
            v-for="square in nodes"
            :key="`text-${square.id}`"
            :config="{
              x: square.x + square.width / 2,
              y: square.y + square.height / 2,
              text: square.nodeType,
              fontSize: 18,
              fontFamily: 'Arial',
              fill: '#ffffff',
              align: 'center',
              verticalAlign: 'middle',
              offsetX: square.nodeType.length * 5,
              offsetY: 7,
              draggable: true
            }"
            @click="(e: any) => handleSquareClick(square.id, e)"
          />
        </v-layer>
      </v-stage>
    </div>
    <InfoPanel :selectedNodes="selectedSquares" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Connector, EnergyNode } from '../types/canvas';
import InfoPanel from './InfoPanel.vue';
import type Konva from 'konva';
import  energyGraph  from '../types/nodes';

const stageWidth = window.innerWidth - 350;
const stageHeight = window.innerHeight;

const nodes = ref<EnergyNode[]>(energyGraph.nodes);

const selectedSquareIds = ref<Set<string>>(new Set());

const connectors = computed<Connector[]>(() => {
  const result: Connector[] = [];
  // nodes.value.forEach(square => {
  //   square.connectors.forEach(targetId => {
  //     const target = nodes.value.find(s => s.id === targetId);
  //     if (target) {
  //       result.push({
  //         id: `${square.id}-${targetId}`,
  //         from: square.id,
  //         to: targetId,
  //         points: [
  //           square.x + square.width / 2,
  //           square.y + square.height / 2,
  //           target.x + target.width / 2,
  //           target.y + target.height / 2
  //         ]
  //       });
  //     }
  //   });
  // });
  return result;
});

const selectedSquares = computed(() => {
  return nodes.value.filter(sq => selectedSquareIds.value.has(sq.id));
});

const handleSquareClick = (squareId: string, event: { evt: MouseEvent }) => {
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

const getSquareFill = (squareId: string) => {
  return selectedSquareIds.value.has(squareId) ? '#10b981' : '#3b82f6';
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
