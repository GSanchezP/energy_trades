import { EnergyNode, NodeLevel, inputTre, outputMap } from './energyNode'
import { EnergyGraph } from './energyGraph'
import * as yaml from 'js-yaml'

// Define the YAML structure types
interface NodeConfig {
  id: string
  level: string
  color: string
  inputs: Record<string, number>
  outputs: Record<string, number>
}

interface NodesConfig {
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
async function loadNodesFromYaml(): Promise<EnergyNode[]> {
  try {
    const response = await fetch('/nodes.yml')
    const yamlContent = await response.text()
    const config = yaml.load(yamlContent) as NodesConfig

    return config.nodes.map((nodeConfig) => {
      const nodeLevel = getNodeLevel(nodeConfig.level)

      return new EnergyNode(
        nodeLevel,
        nodeConfig.id as any, // Type assertion since we know the IDs are valid NodeType
        inputTre(nodeConfig.inputs),
        outputMap(nodeConfig.outputs),
        nodeConfig.color
      )
    })
  } catch (error) {
    console.error('Error loading nodes from YAML:', error)
    throw error
  }
}

const energyGraph = new EnergyGraph()

// Load nodes from YAML configuration asynchronously
loadNodesFromYaml()
  .then((nodes) => {
    nodes.forEach((node) => energyGraph.push(node))

    energyGraph.setNodesOutputDependency()
    energyGraph.calculate()
    energyGraph.calculate()
    energyGraph.calculate()
    energyGraph.calculate()
    energyGraph.calculate()
    energyGraph.calculate()
    energyGraph.calculate()
    energyGraph.addDumpNode()
    energyGraph.resizeNodesByInput()
  })
  .catch((error) => {
    console.error('Failed to load nodes from YAML:', error)
  })

export default energyGraph
