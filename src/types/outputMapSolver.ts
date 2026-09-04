import GLPK, { Result } from 'glpk.js'
import { NodeType, NodesConfig } from './nodesConfig'
import { iNodeWeights, nonPartialNodeWeights } from './energyGraphGenerator'

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
  const nodeFromId = (nodeId: string) => {
    return config.nodes.find((n) => n.id === nodeId)!
  }
  const outputMap: {
    [key: string]: { [key in NodeType]: number }
  } = {}

  for (const node of config.nodes) {
    outputMap[node.id] = iNodeWeights()
    for (const [keyName, value] of Object.entries(vars)) {
      const key = keyName.split(':')
      if (key[1] === node.id && key[2] !== undefined) {
        const target = nodeFromId(key[2])

        outputMap[node.id][target.id as NodeType] = value
      }
    }
    outputMap[node.id] = nonPartialNodeWeights(outputMap[node.id])
  }

  return outputMap
}

// Store the solver result globally
let storedSolverResult: Result | null = null

export function getStoredSolverResult(): Result | null {
  return storedSolverResult
}

export type SolverObjective = 'maximize_leisure' | 'minimize_co2'

export async function outputMapSolver(
  config: NodesConfig,
  objectiveMode: SolverObjective = 'maximize_leisure'
) {
  const bounds: Bound[] = []

  const constraints: Constraint[] = []

  const bound = (name: string, lb = 0, ub = 1) => {
    return { name: `${name}`, type: glpk.GLP_DB, lb, ub }
  }

  const maxOneConstraint = (varName: string) => {
    return {
      name: varName + '_le_1',
      vars: [{ name: varName, coef: 1 }],
      bnds: { type: glpk.GLP_UP, ub: 1, lb: 0 }
    }
  }

  const minOutputConstraint = (varName: string, min: number) => {
    return {
      name: varName + '_ge_min',
      vars: [{ name: varName, coef: 1 }],
      bnds: { type: glpk.GLP_LO, lb: min, ub: 0 }
    }
  }

  const factorConstraint = (varName: string, flowVarName: string, value: number) => {
    return {
      name: varName + '_factor_' + flowVarName,
      vars: [
        { name: varName, coef: 1 },
        { name: flowVarName, coef: -1 / value }
      ],
      bnds: { type: glpk.GLP_FX, ub: 0, lb: 0 }
    }
  }

  const proportionConstraint = (varName: string, propVarName: string, value: number) => {
    return {
      name: varName + '_prop_' + propVarName,
      vars: [
        { name: propVarName, coef: 1 },
        { name: varName, coef: -1 * value }
      ],
      bnds: { type: glpk.GLP_FX, ub: 0, lb: 0 }
    }
  }

  const netSumConstraint = (varName: string, netVarsOutputVar: string[]) => {
    const vars: { name: string; coef: number }[] = []
    for (const netVarOutputVar of netVarsOutputVar) {
      vars.push({ name: netVarOutputVar, coef: 1 })
    }
    vars.push({ name: varName, coef: -1 })
    return {
      name: varName + '_sum',
      vars: vars,
      bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
    }
  }

  // Max Output Constraint (+ optional bare-minimum net output)
  for (const node of config.nodes) {
    const min = node.minOutput ?? 0
    bounds.push(bound(node.netOutputVar, min, 1))
    constraints.push(maxOneConstraint(node.netOutputVar))
    if (min > 0) {
      constraints.push(minOutputConstraint(node.netOutputVar, min))
    }
  }

  // TRE Constraints
  for (const node of config.nodes.filter((n) => Object.keys(n.factors).length > 0)) {
    for (const [inputNode, treValue] of Object.entries(node.factors)) {
      const flowVarName = node.inputFactorVarName(inputNode as NodeType)
      bounds.push(bound(flowVarName))
      constraints.push(factorConstraint(node.netOutputVar, flowVarName, treValue))
    }
  }

  // Addons
  for (const node of config.nodes.filter((n) => Object.keys(n.addons).length > 0)) {
    const sumConstraintsVars: string[] = []
    for (const [inputNode, value] of Object.entries(node.addons)) {
      sumConstraintsVars.push(node.inputFactorVarName(inputNode as NodeType))
      if (value === null) {
        console.log(`Skipping addon ${inputNode} for node ${node.id} because value is null`)
        continue
      }
      constraints.push(
        proportionConstraint(
          node.netOutputVar,
          node.inputFactorVarName(inputNode as NodeType),
          value
        )
      )
    }
    constraints.push(netSumConstraint(node.netOutputVar, sumConstraintsVars))
  }

  // Net output sum constraints
  for (const node of config.nodes) {
    if (node.id === 'leisure') continue // TODO: Figure out this

    const sumConstraintsVars: string[] = []
    for (const sourceNode of config.nodes) {
      if (sourceNode.id === node.id) continue
      for (const targetNode of Object.keys(sourceNode.inputs)) {
        if (targetNode === node.id) {
          sumConstraintsVars.push(sourceNode.inputFactorVarName(node.id))
        }
      }
    }
    constraints.push(netSumConstraint(node.netOutputVar, sumConstraintsVars))
  }

  // Unconstrained CO₂ aggregate: T:co2 = Σ T:node for nodes with co2: true
  const CO2_VAR = 'T:co2'
  const co2Nodes = config.nodes.filter((n) => n.co2)
  bounds.push({ name: CO2_VAR, type: glpk.GLP_FR, lb: 0, ub: 0 })
  if (co2Nodes.length > 0) {
    constraints.push({
      name: 'T:co2_sum',
      vars: [
        ...co2Nodes.map((n) => ({ name: n.netOutputVar, coef: 1 })),
        { name: CO2_VAR, coef: -1 }
      ],
      bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
    })
  }

  const objective =
    objectiveMode === 'minimize_co2'
      ? {
          direction: glpk.GLP_MIN,
          name: 'minimize_co2',
          vars: [{ name: CO2_VAR, coef: 1 }]
        }
      : {
          direction: glpk.GLP_MAX,
          name: 'maximize_leisure',
          vars: [{ name: 'T:leisure', coef: 1 }]
        }

  const lp = {
    name: 'EnergyFlowOptimization2',
    objective,
    subjectTo: constraints,
    bounds: bounds
  }

  const result = await glpk.solve(lp)

  // Store the result
  storedSolverResult = result

  // Convert result to readable format
  const readableResult = formatSolverResult(result, objectiveMode)
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

export type SolverStatusKind = 'success' | 'warning' | 'error' | 'pending' | 'unknown'

export type SolverStatusInfo = {
  kind: SolverStatusKind
  label: string
  /** Material Design Icons class without the `mdi ` prefix, e.g. `mdi-check-circle`. */
  icon: string
}

/** Map GLPK result status to a compact UI badge. */
export function getSolverStatusInfo(result: Result | null | undefined): SolverStatusInfo {
  if (!result) {
    return { kind: 'pending', label: 'No solver result yet', icon: 'mdi-timer-sand' }
  }

  switch (result.result.status) {
    case 1:
      return { kind: 'success', label: 'Optimal solution found', icon: 'mdi-check-circle' }
    case 2:
      return { kind: 'warning', label: 'Feasible solution found', icon: 'mdi-alert' }
    case 3:
    case 4:
    case 9:
    case 11:
    case 14:
      return { kind: 'error', label: 'Infeasible problem', icon: 'mdi-close-circle' }
    case 5:
    case 12:
    case 15:
      return { kind: 'warning', label: 'Unbounded problem', icon: 'mdi-alert' }
    case 7:
    case 8:
      return { kind: 'warning', label: 'Solver limit exceeded', icon: 'mdi-clock-alert' }
    case 10:
      return { kind: 'warning', label: 'Numerical instability', icon: 'mdi-alert' }
    case 6:
    case 13:
    case 16:
    default:
      return { kind: 'unknown', label: 'Undefined solver status', icon: 'mdi-help-circle' }
  }
}

export function formatSolverResult(
  result: Result,
  objectiveMode: SolverObjective = 'maximize_leisure'
): string {
  const lines: string[] = []

  // Header
  lines.push('='.repeat(60))
  lines.push('🔧 LINEAR PROGRAMMING SOLVER RESULTS')
  lines.push('='.repeat(60))

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
  const objectiveLabel =
    objectiveMode === 'minimize_co2' ? 'Minimum achievable CO₂' : 'Maximum achievable Leisure output'
  if (zValue !== undefined) {
    lines.push(`   • Z Value: ${zValue.toFixed(6)}`)
    lines.push(`   • Meaning: ${objectiveLabel}`)
    lines.push(
      `   • Interpretation: ${status === 1 || status === 2 ? '✅ Feasible solution' : '❌ Check status'}`
    )
    if (objectiveMode === 'maximize_leisure' && zValue > 0) {
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

  // Problem Statistics
  lines.push('\n📊 PROBLEM STATISTICS:')
  lines.push(
    `   • Number of Variables: ${result.result?.vars ? Object.keys(result.result.vars).length : 'Unknown'}`
  )
  lines.push(
    `   • Number of Constraints: ${Object.keys(result.result.dual || []).length || 'Unknown'}`
  )
  Object.entries(result.result.dual || [])
    .sort((a, b) => b[1] - a[1])
    .forEach((e) => {
      lines.push(`   • ${e[0]} Lagrange: ${e[1]}`)
    })

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

    lines.push('\n🔍 KEY VARIABLES:')
    Object.entries(vars).forEach(([name, value]) => {
      lines.push(`   • ${name}: ${value}`)
    })
  }

  // Footer
  lines.push('\n' + '='.repeat(60))
  lines.push('📝 END OF SOLVER REPORT')
  lines.push('='.repeat(60))

  return lines.join('\n')
}
