import {
  calibrateFactorsToTargets,
  scoreCalibrationTargets,
  restoreFactors,
  snapshotFactors,
  restoreAddonWeights,
  snapshotAddonWeights
} from "../types/factorCalibration"
import { listFactorEntries, nodesConfig } from "../types/nodesConfig"
import { outputMapSolver, getStoredSolverResult } from "../types/outputMapSolver"

const factorSnap = snapshotFactors()
const addonSnap = snapshotAddonWeights()
restoreFactors(factorSnap)
restoreAddonWeights(addonSnap)

await outputMapSolver(nodesConfig, "maximize_free_time", { quiet: true })
console.log("before score", scoreCalibrationTargets())

const result = await calibrateFactorsToTargets({
  rounds: 3,
  onProgress: (m) => console.log(m)
})

console.log("after score", result.scoreAfter)
console.log(
  "changed",
  result.diffs.map((d) => `${d.nodeId}.${d.inputId}: ${d.baseline.toFixed(4)}→${d.current.toFixed(4)}`)
)

await outputMapSolver(nodesConfig, "maximize_free_time", { quiet: true })
const vars = getStoredSolverResult()?.result?.vars ?? {}
const t = vars["T:transport"] ?? 0
const fe = vars["f:electric_transport:transport"] ?? 0
const he = vars["f:heavy_electric_transport:heavy_transport"] ?? 0
const ht = vars["T:heavy_transport"] ?? 0
console.log("electric light share", t > 0 ? fe / t : 0)
console.log("heavy electric share", ht > 0 ? he / ht : 0)
console.log("T:humanLabor", vars["T:humanLabor"])
console.log("changed count", result.diffs.length, "factors", listFactorEntries().length)
