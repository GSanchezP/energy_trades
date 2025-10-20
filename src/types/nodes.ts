import * as yaml from 'js-yaml'

import path from 'path'
import * as fs from 'fs'

import { EnergyNode, NodeLevel, NodeType, inputTre, outputMap } from './energyNode'

import { EnergyGraph } from './energyGraph'
import { outputMapSolver } from './outputMapSolver'

// Define the YAML structure types
interface NodeConfig {
  id: string
  acr: string
  level: string
  color: string
  inputs: Record<string, number>
}

export interface NodesConfig {
  nodes: NodeConfig[]
}

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

// Function to load and parse YAML configuration
export function loadNodesFromYaml(): NodesConfig {
  try {
    const response = fs.readFileSync(path.resolve('public', 'nodes.yml'), 'utf-8')
    return yaml.load(response) as NodesConfig
  } catch (error) {
    console.error('Error loading nodes from YAML:', error)
    throw error
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
  const nodesConfig = loadNodesFromYaml()
  const outputMap = outputMapSolver(nodesConfig)

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
