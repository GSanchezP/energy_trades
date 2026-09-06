/**
 * Quick solve check for all objectives after factor edits.
 * Run: pnpm dlx tsx ./src/test/check-factors.ts
 */
import generateEnergyGraph, { type SolverObjective } from '../types/energyGraphGenerator'
import {
  assertFactorSumsAtLeastOne,
  nodesConfig
} from '../types/nodesConfig'
import { getSolverStatusInfo, getStoredSolverResult } from '../types/outputMapSolver'

const objectives: SolverObjective[] = [
  'maximize_leisure',
  'maximize_free_time',
  'minimize_co2'
]

assertFactorSumsAtLeastOne(nodesConfig.nodes)
console.log('Factor-sum checks OK for', nodesConfig.nodes.length, 'nodes')

let allOk = true
for (const objective of objectives) {
  await generateEnergyGraph(objective)
  const result = getStoredSolverResult()
  const info = getSolverStatusInfo(result)
  const z = result?.result?.z
  const ok = info.kind === 'success'
  allOk = allOk && ok
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${objective}: status=${result?.result?.status} (${info.label}) z=${z}`
  )
  if (result?.result?.vars) {
    const keys = ['T:leisure', 'T:freeTime', 'T:basicNeeds', 'T:humanLabor', 'T:co2']
    for (const k of keys) {
      if (k in result.result.vars) {
        console.log(`  ${k}=${result.result.vars[k]}`)
      }
    }
  }
}

if (!allOk) {
  process.exitCode = 1
}
