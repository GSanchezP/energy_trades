<script setup lang="ts">
import { computed } from 'vue';
import type { BasicNode, EnergyNode, NodeType } from '../types/energyNode';
import type { Connector } from '../types/energyGraph';

const props = defineProps<{
  selectedNodes: BasicNode[];
  selectedConnector: Connector | null;
}>();

const selectionCount = computed(() => props.selectedNodes.length);

// Remove unused computed property

// Filter to only show EnergyNodes (not BasicNodes like dump)
const energyNodes = computed(() => {
  return props.selectedNodes.filter((node): node is EnergyNode => 
    'nodeType' in node && 'input' in node && 'output' in node
  );
});

// Get all unique node types for table headers
const allNodeTypes: NodeType[] = [
  'Petroleum', 'Minerals', 'Fuels', 'Electricity', 
  'Manufacture', 'Transport', 'WellBeing', 'Leisure', 'Heat'
];

// Helper function to format numbers
const formatNumber = (value: number): string => {
  if (value === 0) return '0';
  if (value < 0.001) return value.toExponential(2);
  return value.toFixed(3);
};
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


        <!-- Energy Node Details Table -->
        <div v-if="energyNodes.length > 0" class="energy-details">
          <h3>Energy Node Details</h3>
          
          <div v-for="node in energyNodes" :key="node.id" class="node-section">
            <div class="node-header">
              <h4>{{ node.nodeType }}</h4>
              <div class="node-meta">
                <span class="node-level">{{ node.nodeLevel }}</span>
                <span class="output-power">Output: {{ formatNumber(node.outputPower) }}</span>
              </div>
            </div>

            <!-- Input Table -->
            <div class="table-section">
              <h5>Input Requirements</h5>
              <div class="table-container">
                <table class="energy-table">
                  <thead>
                    <tr>
                      <th>Node Type</th>
                      <th>Required</th>
                      <th>Current</th>
                      <th>Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="nodeType in allNodeTypes" :key="`input-${nodeType}`">
                      <td class="node-type">{{ nodeType }}</td>
                      <td class="numeric">{{ formatNumber(node.treDependencies[nodeType] || 0) }}</td>
                      <td class="numeric">{{ formatNumber(node.input[nodeType] || 0) }}</td>
                      <td class="numeric ratio" :class="{ 'low-ratio': (node.treDependencies[nodeType] || 0) > 0 && (node.input[nodeType] || 0) / (node.treDependencies[nodeType] || 0) < 0.5 }">
                        {{ (node.treDependencies[nodeType] || 0) > 0 ? formatNumber((node.input[nodeType] || 0) / (node.treDependencies[nodeType] || 0)) : '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Output Table -->
            <div class="table-section">
              <h5>Output Distribution</h5>
              <div class="table-container">
                <table class="energy-table">
                  <thead>
                    <tr>
                      <th>Node Type</th>
                      <th>Percentage</th>
                      <th>Actual Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="nodeType in allNodeTypes" :key="`output-${nodeType}`">
                      <td class="node-type">{{ nodeType }}</td>
                      <td class="numeric">{{ formatNumber((node.outputMap[nodeType] || 0) * 100) }}%</td>
                      <td class="numeric">{{ formatNumber(node.output[nodeType] || 0) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Basic Node Details (for non-energy nodes) -->
        <div v-if="selectedNodes.length > energyNodes.length" class="basic-nodes">
          <h3>Other Selected Items</h3>
          <div v-for="node in selectedNodes.filter(n => !energyNodes.includes(n as EnergyNode))" :key="node.id" class="square-item">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info-panel {
  width: 400px;
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

/* Energy Details Styles */
.energy-details {
  margin-top: 20px;
}

.energy-details h3 {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.node-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.node-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.node-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.node-level {
  background: #3b82f6;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.output-power {
  color: #64748b;
  font-weight: 500;
}

.table-section {
  margin-bottom: 20px;
}

.table-section:last-child {
  margin-bottom: 0;
}

.table-section h5 {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-container {
  overflow-x: auto;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.energy-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  background: white;
}

.energy-table th {
  background: #f1f5f9;
  padding: 8px 6px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.energy-table td {
  padding: 6px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.energy-table tr:last-child td {
  border-bottom: none;
}

.energy-table tr:hover {
  background: #f8fafc;
}

.node-type {
  font-weight: 500;
  color: #1e293b;
}

.numeric {
  text-align: right;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
}

.ratio {
  font-weight: 600;
}

.ratio.low-ratio {
  color: #dc2626;
}

.basic-nodes {
  margin-top: 20px;
}

.basic-nodes h3 {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
