import GLPK from 'glpk.js'
import { NodeType } from './energyNode'
import { NodesConfig } from './nodesConfig'
import { iNodeWeights, nonPartialNodeWeights } from './nodes'

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
  [key: string]: { [key in NodeType]: number }
} {
  const nodeFromAcr = (nodeAcr: string) => {
    return config.nodes.find((n) => n.acr === nodeAcr)!
  }
  const outputMap: {
    [key: string]: { [key in NodeType]: number }
  } = {}

  for (const node of config.nodes) {
    outputMap[node.id] = iNodeWeights()
    for (const [key, value] of Object.entries(vars)) {
      if (key[1] === node.acr && key[2] !== undefined) {
        const target = nodeFromAcr(key[2])

        outputMap[node.id][target.id as NodeType] = value
      }
    }
    outputMap[node.id] = nonPartialNodeWeights(outputMap[node.id])
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
    // if (node.level === 'Extraction') {
    //   constraints.push(fixSourceConstraint(varName))
    //   continue
    // }

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

  // Convert result to readable format
  const readableResult = formatSolverResult(result)
  console.log(readableResult)

  const outputMap: {
    [key: string]: number
  } = {}

  for (const [key, value] of Object.entries(result.result.vars).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    outputMap[key] = value
  }

  const output = solutionToOutputMap(config, outputMap)

  return output
}

function formatSolverResult(result: any): string {
  const lines: string[] = []

  // Header
  lines.push('='.repeat(60))
  lines.push('🔧 LINEAR PROGRAMMING SOLVER RESULTS')
  lines.push('='.repeat(60))

  // Problem Statistics
  lines.push('\n📊 PROBLEM STATISTICS:')
  lines.push(
    `   • Number of Variables: ${result.result?.vars ? Object.keys(result.result.vars).length : 'Unknown'}`
  )
  lines.push(`   • Number of Constraints: ${Object.keys(result.result.dual).length || 'Unknown'}`)

  // Solver Status
  lines.push('\n🎯 SOLVER STATUS:')
  const status = result.result.status
  let statusText = 'Unknown'
  let statusEmoji = '❓'

  switch (status) {
    case 1:
      statusText = 'Optimal solution found'
      statusEmoji = '✅'
      break
    case 2:
      statusText = 'Feasible solution found'
      statusEmoji = '⚠️'
      break
    case 3:
      statusText = 'Infeasible problem'
      statusEmoji = '❌'
      break
    case 4:
      statusText = 'No feasible solution exists'
      statusEmoji = '❌'
      break
    case 5:
      statusText = 'Unbounded problem'
      statusEmoji = '⚠️'
      break
    case 6:
      statusText = 'Undefined solution'
      statusEmoji = '❓'
      break
    case 7:
      statusText = 'Iteration limit exceeded'
      statusEmoji = '⏰'
      break
    case 8:
      statusText = 'Time limit exceeded'
      statusEmoji = '⏰'
      break
    case 9:
      statusText = 'No primal feasible solution'
      statusEmoji = '❌'
      break
    case 10:
      statusText = 'Numerical instability'
      statusEmoji = '⚠️'
      break
    case 11:
      statusText = 'Primal infeasible'
      statusEmoji = '❌'
      break
    case 12:
      statusText = 'Primal unbounded'
      statusEmoji = '⚠️'
      break
    case 13:
      statusText = 'Primal undefined'
      statusEmoji = '❓'
      break
    case 14:
      statusText = 'Dual infeasible'
      statusEmoji = '❌'
      break
    case 15:
      statusText = 'Dual unbounded'
      statusEmoji = '⚠️'
      break
    case 16:
      statusText = 'Dual undefined'
      statusEmoji = '❓'
      break
  }

  lines.push(`   ${statusEmoji} Status Code: ${status} - ${statusText}`)

  // Objective Value (Z value)
  lines.push('\n🎯 OBJECTIVE VALUE (Z):')
  const zValue = result.result?.z
  if (zValue !== undefined) {
    lines.push(`   • Z Value: ${zValue.toFixed(6)}`)
    lines.push(`   • Meaning: Maximum achievable Leisure output`)
    lines.push(
      `   • Interpretation: ${zValue > 0 ? '✅ Feasible solution' : '❌ No feasible solution'}`
    )
    if (zValue > 0) {
      lines.push(`   • Efficiency: ${(zValue * 100).toFixed(2)}% of maximum possible leisure`)
    }
  } else {
    lines.push('   • Z Value: Not available')
  }

  // Timing Information
  lines.push('\n⏱️ PERFORMANCE:')
  if (result.time) {
    lines.push(`   • Solve Time: ${result.time.toFixed(3)} seconds`)
  } else {
    lines.push('   • Solve Time: Not available')
  }

  if (result.iterations) {
    lines.push(`   • Iterations: ${result.iterations}`)
  }

  // Variable Summary
  lines.push('\n📈 VARIABLE SUMMARY:')
  if (result.result?.vars) {
    const vars = result.result.vars
    const varCount = Object.keys(vars).length
    const nonZeroVars = Object.entries(vars).filter(
      ([_, value]) => Math.abs(value as number) > 1e-6
    )

    lines.push(`   • Total Variables: ${varCount}`)
    lines.push(`   • Non-zero Variables: ${nonZeroVars.length}`)
    lines.push(`   • Zero Variables: ${varCount - nonZeroVars.length}`)

    if (nonZeroVars.length > 0) {
      lines.push('\n🔍 KEY VARIABLES (Non-zero values):')
      nonZeroVars.slice(0, 10).forEach(([name, value]) => {
        lines.push(`   • ${name}: ${(value as number).toFixed(6)}`)
      })
      if (nonZeroVars.length > 10) {
        lines.push(`   • ... and ${nonZeroVars.length - 10} more variables`)
      }
    }
  }

  // Footer
  lines.push('\n' + '='.repeat(60))
  lines.push('📝 END OF SOLVER REPORT')
  lines.push('='.repeat(60))

  return lines.join('\n')
}
