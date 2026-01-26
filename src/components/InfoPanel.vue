<template>
  <div class="info-panel">
    <div class="panel-content">
      <div class="selection-info">
        <!-- Connector Information -->
        <div v-if="selectedConnector" class="connector-info">
          <div class="section-header">
            <h2>🔗 Energy Flow</h2>
          </div>

          <div class="metrics-grid">
            <div class="metric-card Extraction">
              <div class="metric-label">Flow Direction</div>
              <div class="metric-value">
                {{ selectedConnector.from }} → {{ selectedConnector.to }}
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-label">Power Flow</div>
              <div class="metric-value">{{ formatNumber(selectedConnector.power) }}</div>
            </div>

            <div class="metric-card">
              <div class="metric-label">Visual Weight</div>
              <div class="metric-value">{{ selectedConnector.strokeWidth.toFixed(1) }}px</div>
            </div>
          </div>
        </div>

        <!-- Energy Node Details -->
        <div v-if="energyNodes.length > 0" class="energy-details">
          <div v-for="node in energyNodes" :key="node.id" class="node-section">
            <!-- Node Header -->
            <div class="node-header">
              <div class="node-title">
                <h2>{{ node.id }}</h2>
                <div>{{ node.level.id }}</div>
              </div>
            </div>

            <!-- Input Requirements Table -->
            <div class="table-section">
              <h3>📥 Input Requirements</h3>
              <div class="table-container">
                <table class="energy-table">
                  <thead>
                    <tr>
                      <th>Resource Type</th>
                      <th>Needed</th>
                      <th>Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="input in getNonZeroInputs(node)" :key="`input-${input.nodeType}`">
                      <td class="node-type">
                        {{ input.nodeType }}
                        <span v-if="input.isAddon" class="addon-badge">(addon)</span>
                      </td>
                      <td class="numeric">
                        {{
                          input.isAddon
                            ? (node.eroiAddons[input.nodeType] === null || node.eroiAddons[input.nodeType] === undefined
                                ? 'null'
                                : formatNumber(node.eroiAddons[input.nodeType] || 0))
                            : formatNumber(node.eroiFactors[input.nodeType] || 0)
                        }}
                      </td>
                      <td class="numeric">
                        {{ formatNumber(node.inputMap[input.nodeType] || 0) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Output Distribution Table -->
            <div class="table-section">
              <h3>📤 Output Distribution</h3>
              <div class="table-container">
                <table class="energy-table">
                  <thead>
                    <tr>
                      <th>Resource Type</th>
                      <th>Percentage</th>
                      <th>Actual Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="nodeType in getNonZeroOutputs(node)" :key="`output-${nodeType}`">
                      <td class="node-type">{{ nodeType }}</td>
                      <td class="numeric">{{ formatPercentage(node.outputMap[nodeType] || 0) }}</td>
                      <td class="numeric">{{ formatNumber(node.outputMap[nodeType] || 0) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Basic Node Details (for non-energy nodes) -->
        <div v-if="basicNodes.length > 0" class="basic-nodes">
          <div class="section-header">
            <h2>📦 Other Selected Items</h2>
          </div>
          <div v-for="node in basicNodes" :key="node.id" class="basic-node-item">
            <div class="basic-node-header">
              <h3>{{ node.id }}</h3>
              <div class="basic-node-meta">
                <span class="position"
                  >Position: ({{ Math.round(node.x) }}, {{ Math.round(node.y) }})</span
                >
                <span class="size">Size: {{ node.width }}×{{ node.height }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EnergyNode } from '../types/energyNode'
import type { Connector } from '../types/energyGraphDrawer'
import { NodeDrawer } from '../types/nodeDrawer'
import { NodeTypes, type NodeType, nodesConfig } from '../types/nodesConfig'

const props = defineProps<{
  selectedNodes: any[]
  selectedConnector: Connector | null
  energyGraph?: any
}>()

// Filter to only show EnergyNodes (not BasicNodes like dump)
const energyNodes = computed(() => {
  return props.selectedNodes.filter(
    (node): node is EnergyNode => 'inputMap' in node && 'outputMap' in node
  )
})

// Helper function to format numbers
const formatNumber = (value: number): string => {
  if (value === 0) return '0'
  if (value < 0.001) return value.toExponential(2)
  return value.toFixed(3)
}

// Helper function to format percentages
const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`
}

// Get non-energy nodes (BasicNodes like dump)
const basicNodes = computed(() => {
  return props.selectedNodes.filter(
    (node): node is NodeDrawer => !('inputMap' in node && 'outputMap' in node)
  )
})

// Get nodeConfig for a given node
const getNodeConfig = (node: EnergyNode) => {
  return nodesConfig.nodes.find((n) => n.id === node.id)
}

// Get non-zero input requirements (both factors and addons)
const getNonZeroInputs = (node: EnergyNode): Array<{ nodeType: NodeType; isAddon: boolean }> => {
  const inputs: Array<{ nodeType: NodeType; isAddon: boolean }> = []

  // Add factors (from eroiFactors)
  for (const nodeType of NodeTypes) {
    const needed = node.eroiFactors[nodeType] || 0
    if (needed > 0) {
      inputs.push({ nodeType, isAddon: false })
    }
  }

  // Add addons (from eroiAddons) - show if number or null, skip if undefined
  for (const nodeType of NodeTypes) {
    const addonValue = node.eroiAddons[nodeType]
    if (addonValue !== undefined) {
      // Only add if not already in factors
      if (!inputs.some((input) => input.nodeType === nodeType && !input.isAddon)) {
        inputs.push({ nodeType, isAddon: true })
      }
    }
  }

  return inputs
}

// Get non-zero outputs
const getNonZeroOutputs = (node: EnergyNode): NodeType[] => {
  return NodeTypes.filter((nodeType) => {
    const output = node.outputMap[nodeType] || 0
    return output > 0
  })
}
</script>

<style scoped>
.info-panel {
  width: 600px;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border-left: 2px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #374151;
}

.empty-state p {
  margin: 0 0 20px 0;
  font-size: 16px;
  color: #6b7280;
}

.hint {
  font-size: 14px;
  line-height: 1.6;
  color: #9ca3af;
}

.hint p {
  margin: 4px 0;
}

/* Selection Info */
.selection-info {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Section Headers */
.section-header {
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Connector Info */
.connector-info {
  background: linear-gradient(135deg, #dbeafe 0%, #f0f9ff 100%);
  border: 2px solid #3b82f6;
  border-radius: 12px;
  padding: 20px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

.metric-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  transition: all 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.metric-card.Extraction {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  border-color: #1d4ed8;
}

.metric-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.metric-card.Extraction .metric-label {
  color: rgba(255, 255, 255, 0.8);
}

.metric-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.metric-card.Extraction .metric-value {
  color: white;
}

/* Energy Details */
.energy-details {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.node-section {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.node-section:hover {
  border-color: #3b82f6;
  box-shadow: 0 8px 30px rgba(59, 130, 246, 0.1);
}

/* Node Header */
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f1f5f9;
}

.node-title {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.node-title h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.node-level-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: white;
}

.level-0 {
  background: #6b7280;
}
.level-1 {
  background: #694908;
}
.level-2 {
  background: #a226dc;
}
.level-3 {
  background: #6d9029;
}
.level-4 {
  background: #1ba90e;
}
.level-5 {
  background: #c953bdff;
}

.key-metrics {
  display: flex;
  gap: 12px;
}

.key-metrics .metric-card {
  min-width: 120px;
  padding: 12px;
}

.key-metrics .metric-label {
  font-size: 10px;
}

.key-metrics .metric-value {
  font-size: 16px;
}

.metric-description {
  font-size: 10px;
  color: #64748b;
  margin-top: 4px;
  font-style: italic;
}

/* Efficiency Classes */
.metric-card.excellent {
  border-color: #10b981;
  background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
}
.metric-card.good {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%);
}
.metric-card.moderate {
  border-color: #f59e0b;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}
.metric-card.poor {
  border-color: #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}
.metric-card.critical {
  border-color: #dc2626;
  background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
}

/* Power Summary */
.power-summary {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.power-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.power-input,
.power-output,
.power-losses {
  text-align: center;
  flex: 1;
}

.power-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.power-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.power-arrow {
  font-size: 24px;
  color: #3b82f6;
  font-weight: bold;
}

.power-losses .power-value {
  color: #dc2626;
}

/* Table Sections */
.table-section {
  margin-bottom: 24px;
}

.table-section:last-child {
  margin-bottom: 0;
}

.table-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
}

.energy-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.energy-table th {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.energy-table td {
  padding: 10px 8px;
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
  font-weight: 600;
  color: #1e293b;
}

.numeric {
  text-align: right;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

/* Satisfaction Bar */
.satisfaction-bar {
  position: relative;
  width: 100px;
  height: 20px;
  background: #f1f5f9;
  border-radius: 10px;
  overflow: hidden;
  margin: 0 auto;
}

.satisfaction-fill {
  height: 100%;
  border-radius: 10px;
  transition: width 0.3s ease;
}

.satisfaction-fill.satisfied {
  background: linear-gradient(90deg, #10b981, #059669);
}

.satisfaction-fill.partial {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.satisfaction-fill.unsatisfied {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.satisfaction-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Status Badges */
.status-badge {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  text-align: center;
  line-height: 24px;
  font-size: 12px;
  font-weight: bold;
}

.status-badge.satisfied {
  background: #10b981;
  color: white;
}

.status-badge.partial {
  background: #f59e0b;
  color: white;
}

.status-badge.unsatisfied {
  background: #ef4444;
  color: white;
}

.no-requirement,
.no-output {
  color: #9ca3af;
  font-style: italic;
}

.addon-badge {
  font-size: 10px;
  color: #6b7280;
  font-weight: normal;
  font-style: italic;
  margin-left: 4px;
}

/* Output Bar */
.output-bar {
  width: 80px;
  height: 16px;
  background: #f1f5f9;
  border-radius: 8px;
  overflow: hidden;
  margin: 0 auto;
}

.output-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  border-radius: 8px;
  transition: width 0.3s ease;
}

/* Basic Nodes */
.basic-nodes {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
}

.basic-node-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.basic-node-item:last-child {
  margin-bottom: 0;
}

.basic-node-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #3b82f6;
  margin: 0 0 8px 0;
}

.basic-node-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  color: #64748b;
}

.position,
.size {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

/* Responsive Design */
@media (max-width: 768px) {
  .info-panel {
    width: 100%;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .key-metrics {
    flex-direction: column;
  }

  .power-flow {
    flex-direction: column;
    gap: 8px;
  }

  .power-arrow {
    transform: rotate(90deg);
  }
}

/* EROI Chart Styles */
.overall-eroi {
  margin: 20px 0;
}

.eroi-chart {
  margin: 20px 0;
}

.eroi-chart h4 {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 16px 0;
  text-align: center;
}

.chart-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  min-width: 100px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.bar-container {
  flex: 1;
  position: relative;
  height: 24px;
  background: #f1f5f9;
  border-radius: 12px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 12px;
  transition: width 0.3s ease;
  position: relative;
}

.bar-value {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  font-size: 12px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
</style>
