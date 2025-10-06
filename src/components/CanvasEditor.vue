<script setup lang="ts">
import { ref, computed } from 'vue';
import type { CanvasSquare, Connector } from '../types/canvas';
import InfoPanel from './InfoPanel.vue';
import type Konva from 'konva';

const stageWidth = window.innerWidth - 350;
const stageHeight = window.innerHeight;

const squares = ref<CanvasSquare[]>([
  {
    id: 'sq1',
    x: 100,
    y: 100,
    width: 80,
    height: 80,
    fill: '#3b82f6',
    connectors: ['sq2']
  },
  {
    id: 'sq2',
    x: 300,
    y: 200,
    width: 80,
    height: 80,
    fill: '#3b82f6',
    connectors: []
  },
  {
    id: 'sq3',
    x: 500,
    y: 150,
    width: 80,
    height: 80,
    fill: '#3b82f6',
    connectors: ['sq1']
  }
]);

const selectedSquareIds = ref<Set<string>>(new Set());

const connectors = computed<Connector[]>(() => {
  const result: Connector[] = [];
  squares.value.forEach(square => {
    square.connectors.forEach(targetId => {
      const target = squares.value.find(s => s.id === targetId);
      if (target) {
        result.push({
          id: `${square.id}-${targetId}`,
          from: square.id,
          to: targetId,
          points: [
            square.x + square.width / 2,
            square.y + square.height / 2,
            target.x + target.width / 2,
            target.y + target.height / 2
          ]
        });
      }
    });
  });
  return result;
});

const selectedSquares = computed(() => {
  return squares.value.filter(sq => selectedSquareIds.value.has(sq.id));
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

const handleSquareDragEnd = (squareId: string, event: { target: Konva.Node }) => {
  const square = squares.value.find(sq => sq.id === squareId);
  if (square) {
    square.x = event.target.x();
    square.y = event.target.y();
  }
};

const getSquareFill = (squareId: string) => {
  return selectedSquareIds.value.has(squareId) ? '#10b981' : '#3b82f6';
};
</script>

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
            v-for="square in squares"
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
              draggable: true
            }"
            @click="(e: any) => handleSquareClick(square.id, e)"
            @dragend="(e: any) => handleSquareDragEnd(square.id, e)"
          />
        </v-layer>
      </v-stage>
    </div>
    <InfoPanel :selected-squares="selectedSquares" />
  </div>
</template>

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
