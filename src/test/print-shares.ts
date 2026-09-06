/**
 * Print solved net outputs and sum-node technology shares.
 * Run: pnpm dlx tsx ./src/test/print-shares.ts
 */
import generateEnergyGraph, { type SolverObjective } from '../types/energyGraphGenerator'
import { nodesConfig } from '../types/nodesConfig'
import { getStoredSolverResult } from '../types/outputMapSolver'

const objective: SolverObjective = (process.argv[2] as SolverObjective) || 'maximize_free_time'

await generateEnergyGraph(objective)
const vars = getStoredSolverResult()?.result?.vars ?? {}

console.log('\nObjective:', objective)
console.log('\nNet outputs T:*')
for (const n of nodesConfig.nodes) {
  const t = vars[`T:${n.id}`]
  if (t === undefined) continue
  console.log(`  T:${n.id}`.padEnd(32), t.toFixed(6))
}

console.log('\nSum-node technology shares (addon flow / T:sum)')
for (const sum of nodesConfig.nodes.filter((n) => Object.keys(n.addons).length > 0)) {
  const tSum = vars[`T:${sum.id}`] ?? 0
  console.log(`  ${sum.id}  T=${tSum.toFixed(6)}`)
  for (const addonId of Object.keys(sum.addons)) {
    const flow = vars[`f:${addonId}:${sum.id}`] ?? 0
    const share = tSum > 1e-12 ? flow / tSum : 0
    console.log(`    ${addonId}`.padEnd(30), `flow=${flow.toFixed(6)}  share=${(share * 100).toFixed(2)}%`)
  }
}

console.log('\nTime budget (residual identity)')
for (const id of ['basicNeeds', 'humanLabor', 'leisure', 'freeTime']) {
  console.log(`  T:${id}`.padEnd(20), (vars[`T:${id}`] ?? 0).toFixed(6))
}
