import {
  NodeLevel,
  NodeLevels,
  NodeType,
  NodeTypes,
  NodeWeights,
  NodesConfig,
  nodesConfig
} from './nodesConfig'

import { EnergyGraphDrawer } from './energyGraphDrawer'
import { EnergyNode } from './energyNode'
import { outputMapSolver, getStoredSolverResult, type SolverObjective } from './outputMapSolver'

export function generateNodes(
  config: NodesConfig,
  outputMaps: { [key: string]: NodeWeights },
  inputMaps: Record<string, NodeWeights>
): EnergyNode[] {
  const nodeLevelPositions = Object.fromEntries(NodeLevels.map((level) => [level, 0])) as Record<
    NodeLevel,
    number
  >
  const solvedVars = getStoredSolverResult()?.result?.vars

  return config.nodes.map((nodeConfig) => {
    const isSum = Object.keys(nodeConfig.addons).length > 0
    // Sum nodes are laid out beside their addons; keep level positions for regular nodes only.
    const nodeLevelPosition = isSum ? 0 : nodeLevelPositions[nodeConfig.level]++
    const isResidual = nodeConfig.isResidual
    const displayPower = isResidual
      ? (solvedVars?.[nodeConfig.netOutputVar] ?? 0)
      : undefined
    return new EnergyNode(
      nodeConfig.label,
      nodeConfig.level,
      nodeLevelPosition,
      nodeConfig.id,
      nonPartialNodeWeights(nodeConfig.factors),
      nodeConfig.addons,
      inputMaps[nodeConfig.id] ?? iNodeWeights(),
      outputMaps[nodeConfig.id] ?? iNodeWeights(),
      nodeConfig.color,
      isResidual ? { isolated: true, displayPower } : undefined
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

export async function generateEnergyGraph(
  objective: SolverObjective = 'maximize_leisure'
): Promise<EnergyGraphDrawer> {
  const outputMap: { [key: string]: NodeWeights } = await outputMapSolver(nodesConfig, objective)
  const inputMap: { [key: string]: NodeWeights } = inputMapFromOutputMap(outputMap)

  const energyGraph = new EnergyGraphDrawer(generateNodes(nodesConfig, outputMap, inputMap))

  return energyGraph
}

export default generateEnergyGraph
export type { SolverObjective }
