<script setup lang="ts">
import { computed } from 'vue';
import type { Connector, BasicNode } from '../types/canvas';

const props = defineProps<{
  selectedNodes: BasicNode[];
  selectedConnector: Connector | null;
}>();

const selectionCount = computed(() => props.selectedNodes.length);

const totalConnections = computed(() => {
  // return props.selectedNodes.reduce((sum, sq) => sum + sq.connectors.length, 0);
  return 0
});
</script>

<template>
  <div class="info-panel">
    <div class="panel-header">
      <h2>Information</h2>
    </div>

    <div class="panel-content">
      <div v-if="selectionCount === 0 && !selectedConnector" class="empty-state">
        <p>No squares or connectors selected</p>
        <p class="hint">Click a square to select it<br>Hold Shift to select multiple<br>Click a connector to see flow details</p>
      </div>

      <div v-else class="selection-info">
        <!-- Connector Information -->
        <div v-if="selectedConnector" class="connector-info">
          <div class="info-card">
            <div class="info-label">Energy Flow</div>
            <div class="info-value">{{ selectedConnector.from }} → {{ selectedConnector.to }}</div>
          </div>

          <div class="info-card">
            <div class="info-label">Power Output</div>
            <div class="info-value">{{ selectedConnector.power.toFixed(3) }}</div>
          </div>

          <div class="info-card">
            <div class="info-label">Line Thickness</div>
            <div class="info-value">{{ selectedConnector.strokeWidth.toFixed(1) }}px</div>
          </div>

          <div class="flow-details">
            <h3>Flow Details</h3>
            <div class="detail-row">
              <span class="detail-label">Source:</span>
              <span class="detail-value">{{ selectedConnector.from }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Target:</span>
              <span class="detail-value">{{ selectedConnector.to }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Power:</span>
              <span class="detail-value">{{ selectedConnector.power.toFixed(4) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Stroke Width:</span>
              <span class="detail-value">{{ selectedConnector.strokeWidth.toFixed(1) }}px</span>
            </div>
          </div>
        </div>

        <!-- Node Information -->
        <div v-if="selectionCount > 0">
          <div class="info-card">
            <div class="info-label">Selected Squares</div>
            <div class="info-value">{{ selectionCount }}</div>
          </div>

          <div class="info-card">
            <div class="info-label">Total Connections</div>
            <div class="info-value">{{ totalConnections }}</div>
          </div>
        </div>

        <div class="squares-list">
          <h3>Square Details</h3>
          <div v-for="node in selectedNodes" :key="node.id" class="square-item">
            <div class="square-id">{{ node.id }}</div>
            <div class="square-details">
              <div class="detail-row">
                <span class="detail-label">Position:</span>
                <span class="detail-value">({{ Math.round(node.x) }}, {{ Math.round(node.y) }})</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Size:</span>
                <span class="detail-value">{{ node.width }}x{{ node.height }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Connections:</span>
                <!-- <span class="detail-value">{{ node.connectors.length }}</span> -->
              </div>
              <!-- <div v-if="node.connectors.length > 0" class="connections">
                <span class="detail-label">Connected to:</span>
                <div class="connection-tags">
                  <span v-for="conn in node.connectors" :key="conn" class="tag">{{ conn }}</span>
                </div>
              </div> -->
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info-panel {
  width: 350px;
  background: white;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}

.empty-state p {
  margin: 0 0 16px 0;
  font-size: 16px;
}

.hint {
  font-size: 14px;
  line-height: 1.5;
}

.selection-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-card {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.info-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.info-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.squares-list h3 {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.square-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.square-id {
  font-size: 16px;
  font-weight: 600;
  color: #3b82f6;
  margin-bottom: 12px;
}

.square-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.detail-label {
  color: #64748b;
  font-weight: 500;
}

.detail-value {
  color: #1e293b;
  font-weight: 600;
}

.connections {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

.connection-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.tag {
  background: #3b82f6;
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.connector-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.flow-details {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.flow-details h3 {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
