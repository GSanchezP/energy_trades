import { EnergyNode, NodeLevel, NodeType, NodeWeights } from './energyNode'

import { EnergyGraph } from './energyGraph'
import { outputMapSolver } from './outputMapSolver'
import { nodesConfig, NodesConfig } from './nodesConfig'

// Function to convert level string to NodeLevel enum
function getNodeLevel(level: string): NodeLevel {
  switch (level) {
    case 'Primary':
      return NodeLevel.Primary
    case 'Conversion':
      return NodeLevel.Conversion
    case 'Industrial':
      return NodeLevel.Industrial
    case 'Societal':
      return NodeLevel.Societal
    case 'Target':
      return NodeLevel.Target
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
  return {
    Petroleum: 0,
    Coal: 0,
    Minerals: 0,
    Fuels: 0,
    Electricity: 0,
    Manufacture: 0,
    Transport: 0,
    WellBeing: 0,
    Leisure: 0,
    Heat: 0
  }
}

export function nonPartialNodeWeights(input: { [key in NodeType]?: number }): NodeWeights {
  return {
    Petroleum: input.Petroleum ?? 0,
    Coal: input.Coal ?? 0,
    Minerals: input.Minerals ?? 0,
    Fuels: input.Fuels ?? 0,
    Electricity: input.Electricity ?? 0,
    Manufacture: input.Manufacture ?? 0,
    Transport: input.Transport ?? 0,
    WellBeing: input.WellBeing ?? 0,
    Leisure: input.Leisure ?? 0,
    Heat: input.Heat ?? 0
  }
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

export async function getEnergyGraph(): Promise<EnergyGraph> {
  const energyGraph = new EnergyGraph()

  // Load nodes from YAML configuration asynchronously
  const outputMap: { [key: string]: NodeWeights } = await outputMapSolver(nodesConfig)
  const inputMap: { [key: string]: NodeWeights } = inputMapFromOutputMap(outputMap)

  console.log('-----OUTPUT MAP------')
  console.log(outputMap)
  console.log('-----INPUT MAP------')
  console.log(inputMap)

  generateNodes(nodesConfig, outputMap, inputMap).forEach((node) => energyGraph.push(node))

  energyGraph.addDumpNode()

  return energyGraph
}

export default getEnergyGraph
