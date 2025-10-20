import { EnergyNode, NodeLevel, NodeType, inputTre, outputMap } from './energyNode'

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
    case 'Dump':
      return NodeLevel.Dump
    default:
      throw new Error(`Unknown node level: ${level}`)
  }
}

export function generateNodes(
  config: NodesConfig,
  outputMaps: { [key: string]: { [key in NodeType]?: number } }
): EnergyNode[] {
  return config.nodes.map((nodeConfig) => {
    const nodeLevel = getNodeLevel(nodeConfig.level)

    return new EnergyNode(
      nodeLevel,
      nodeConfig.id as any, // Type assertion since we know the IDs are valid NodeType
      inputTre(nodeConfig.inputs),
      outputMap(outputMaps[nodeConfig.id]),
      nodeConfig.color
    )
  })
}

export async function getEnergyGraph(): Promise<EnergyGraph> {
  const energyGraph = new EnergyGraph()

  // Load nodes from YAML configuration asynchronously
  const outputMap = await outputMapSolver(nodesConfig)

  console.log(outputMap)

  const nodes = generateNodes(nodesConfig, outputMap)

  nodes.forEach((node) => energyGraph.push(node))

  energyGraph.setNodesOutputDependency()
  energyGraph.calculate()
  energyGraph.addDumpNode()
  energyGraph.resizeNodesByInput()

  return energyGraph
}

export default getEnergyGraph
