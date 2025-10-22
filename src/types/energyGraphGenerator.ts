import { EnergyNode, NodeLevel, NodeType, NodeTypes, NodeWeights } from './energyNode'

import { EnergyGraph } from './energyGraph'
import { outputMapSolver } from './outputMapSolver'
import { nodesConfig, NodesConfig } from './nodesConfig'

// Function to convert level string to NodeLevel enum
function getNodeLevel(level: string): NodeLevel {
  switch (level) {
    case 'Extraction':
      return NodeLevel.Extraction
    case 'Conversion':
      return NodeLevel.Conversion
    case 'Primary':
      return NodeLevel.Primary
    case 'Industrial':
      return NodeLevel.Industrial
    case 'Tertiary':
      return NodeLevel.Tertiary
    case 'Dump':
      return NodeLevel.Dump
    default:
      throw new Error(`Unknown node level: ${level}`)
  }
}

export function generateNodes(
  config: NodesConfig,
  outputMaps: { [key: string]: NodeWeights },
  inputMaps: { [key: string]: NodeWeights }
): EnergyNode[] {
  return config.nodes.map((nodeConfig) => {
    const nodeLevel = getNodeLevel(nodeConfig.level)

    return new EnergyNode(
      nodeLevel,
      nodeConfig.id as any, // Type assertion since we know the IDs are valid NodeType
      nonPartialNodeWeights(nodeConfig.inputs),
      inputMaps[nodeConfig.id],
      outputMaps[nodeConfig.id],
      nodeConfig.color
    )
  })
}

export const iNodeWeights = () => {
  const obj: any = {}

  for (const key of NodeTypes) {
    obj[key] = 0
  }

  return obj
}

export function nonPartialNodeWeights(input: { [key in NodeType]?: number }): NodeWeights {
  const obj: any = {}

  for (const key of NodeTypes) {
    obj[key] = input?.[key] ?? 0
  }

  return obj
}

function inputMapFromOutputMap(outputMap: { [key: string]: Partial<NodeWeights> }) {
  const inputMap: { [key: string]: NodeWeights } = {}

  // Initialize input map for all nodes
  for (const nodeKey of Object.keys(outputMap)) {
    inputMap[nodeKey] = iNodeWeights()
  }

  // For each node's output map, add those outputs as inputs to the target nodes
  for (const [sourceNode, outputWeights] of Object.entries(outputMap)) {
    const nonPartialOutputWeights = nonPartialNodeWeights(outputWeights)

    for (const [targetNode, weight] of Object.entries(nonPartialOutputWeights)) {
      if (weight > 0) {
        inputMap[targetNode][sourceNode as NodeType] = weight
      }
    }
  }

  return inputMap
}

export async function generateEnergyGraph(): Promise<EnergyGraph> {
  const energyGraph = new EnergyGraph()

  // Load nodes from YAML configuration asynchronously
  const outputMap: { [key: string]: NodeWeights } = await outputMapSolver(nodesConfig)
  const inputMap: { [key: string]: NodeWeights } = inputMapFromOutputMap(outputMap)

  generateNodes(nodesConfig, outputMap, inputMap).forEach((node) => energyGraph.push(node))

  energyGraph.addDumpNode()

  return energyGraph
}

export default generateEnergyGraph
