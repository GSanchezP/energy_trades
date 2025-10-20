import GLPK from 'glpk.js'
import { NodeType } from './energyNode'
import { NodesConfig } from './nodesConfig'

const glpk = await GLPK()

type Bound = {
  name: string
  type: number
  lb: number
  ub: number
}

type Constraint = {
  name: string
  vars: {
    name: string
    coef: number
  }[]
  bnds: {
    type: number
    lb: number
    ub: number
  }
}

function solutionToOutputMap(
  config: NodesConfig,
  vars: { [key: string]: number }
): {
  [key: string]: { [key in NodeType]?: number }
} {
  const nodeFromAcr = (nodeAcr: string) => {
    return config.nodes.find((n) => n.acr === nodeAcr)!
  }
  const outputMap: {
    [key: string]: { [key in NodeType]?: number }
  } = {}

  for (const node of config.nodes) {
    outputMap[node.id] = {}
    let totalEnergy = 0
    for (const [key, value] of Object.entries(vars)) {
      if (key[1] === node.acr && key[2] === undefined) {
        totalEnergy = value
        continue
      } else if (key[1] === node.acr) {
        const target = nodeFromAcr(key[2])
        if (totalEnergy === 0) {
          throw new Error(`TotalEnergy from ${node.id} not set yet, while computing ${target.id}`)
        }
        outputMap[node.id][target.id as NodeType] = value / totalEnergy
      }
    }
  }

  return outputMap
}

export async function outputMapSolver(config: NodesConfig) {
  const bounds: Bound[] = []

  const constraints: Constraint[] = []

  const nodeAcr = (nodeName: string) => {
    return config.nodes.find((n) => n.id === nodeName)?.acr!
  }

  const bound = (name: string) => {
    return { name: `${name}`, type: glpk.GLP_DB, lb: 0, ub: 1 }
  }

  const minOneConstraint = (varName: string) => {
    return {
      name: varName + '_le_1',
      vars: [{ name: varName, coef: 1 }],
      bnds: { type: glpk.GLP_UP, ub: 1, lb: 0 }
    }
  }

  const minTreConstraint = (varName: string, flowVarName: string, value: number) => {
    return {
      name: varName + '_le_' + flowVarName,
      vars: [
        { name: varName, coef: 1 },
        { name: flowVarName, coef: -1 / value }
      ],
      bnds: { type: glpk.GLP_UP, ub: 0, lb: 0 }
    }
  }

  const fixSourceConstraint = (varName: string) => {
    return {
      name: varName + '_fixed',
      vars: [{ name: varName, coef: 1 }],
      bnds: { type: glpk.GLP_FX, lb: 1, ub: 1 }
    }
  }

  const netSumConstraint = (varName: string, netVarsOutput: string[]) => {
    const vars: { name: string; coef: number }[] = []
    for (const netVarOuput of netVarsOutput) {
      vars.push({ name: netVarOuput, coef: 1 })
    }
    vars.push({ name: varName, coef: -1 })
    return {
      name: varName + '_sum',
      vars: vars,
      bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
    }
  }

  // Var Bounds
  for (const node of config.nodes) {
    const varName = 'x' + node.acr
    bounds.push(bound(varName))
  }

  // TRE Constraints
  for (const node of config.nodes) {
    const varName = 'x' + node.acr

    // TODO: This should be removed
    if (node.level === 'Primary') {
      constraints.push(fixSourceConstraint(varName))
      continue
    }

    constraints.push(minOneConstraint(varName))
    for (const [inputNode, treValue] of Object.entries(node.inputs)) {
      const flowVarName = `x${nodeAcr(inputNode)}${node.acr}`
      bounds.push(bound(flowVarName))
      constraints.push(minTreConstraint(varName, flowVarName, treValue))
    }
  }

  // Net sum constraints
  for (const node of config.nodes) {
    const varName = 'x' + node.acr
    if (node.id === 'Leisure') continue // TODO: Figure out this
    const sumConstraints: string[] = []
    for (const sourceNode of config.nodes) {
      if (sourceNode.id === node.id) continue
      for (const targetNode of Object.keys(sourceNode.inputs)) {
        if (targetNode === node.id) {
          sumConstraints.push(`x${node.acr}${sourceNode.acr}`)
        }
      }
    }
    constraints.push(netSumConstraint(varName, sumConstraints))
  }

  const objective = {
    direction: glpk.GLP_MAX,
    name: 'maximize_leisure',
    vars: [{ name: 'xl', coef: 1 }]
  }

  const lp = {
    name: 'EnergyFlowOptimization2',
    objective,
    subjectTo: constraints,
    bounds: bounds
  }

  const result = await glpk.solve(lp)

  const outpuMap: {
    [key: string]: number
  } = {}

  for (const [key, value] of Object.entries(result.result.vars).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    outpuMap[key] = value
  }

  const output = solutionToOutputMap(config, outpuMap)

  console.log(output)

  return output
}
