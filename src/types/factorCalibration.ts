import {
  getFactorSumFailures,
  listFactorEntries,
  nodesConfig,
  replaceNodeConfig,
  restoreFactors,
  setNodeFactor,
  snapshotFactors,
  NodeConfig,
  type NodeType
} from './nodesConfig'
import {
  getStoredSolverResult,
  outputMapSolver,
  type SolverObjective
} from './outputMapSolver'

export type FactorDiff = {
  nodeId: NodeType
  inputId: NodeType
  baseline: number
  current: number
  delta: number
  comment?: string
}

/** Weighted L1 gap of the last solve vs `nodesConfig.calibration` targets. */
export function scoreCalibrationTargets(vars?: Record<string, number>): number {
  const v = vars ?? getStoredSolverResult()?.result?.vars ?? {}
  const calib = nodesConfig.calibration
  if (!calib) return 0

  let score = 0

  for (const [nodeId, spec] of Object.entries(calib.netOutputs ?? {})) {
    if (!spec) continue
    const t = v[`T:${nodeId}`] ?? 0
    score += (spec.weight ?? 1) * Math.abs(t - spec.target)
  }

  for (const [sumId, shares] of Object.entries(calib.addonShares ?? {})) {
    if (!shares) continue
    const tSum = v[`T:${sumId}`] ?? 0
    for (const [addonId, spec] of Object.entries(shares)) {
      if (!spec) continue
      const flow = v[`f:${addonId}:${sumId}`] ?? 0
      const share = tSum > 1e-12 ? flow / tSum : 0
      score += (spec.weight ?? 1) * Math.abs(share - spec.target)
    }
  }

  return score
}

export function diffAgainstBaseline(baseline: Record<string, number>): FactorDiff[] {
  const diffs: FactorDiff[] = []
  for (const row of listFactorEntries()) {
    const key = `${row.nodeId}|${row.inputId}`
    const base = baseline[key] ?? row.value
    diffs.push({
      nodeId: row.nodeId,
      inputId: row.inputId,
      baseline: base,
      current: row.value,
      delta: row.value - base,
      comment: row.comment
    })
  }
  return diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

/** Snapshot / restore sum-node addon weights (null = free). */
export function snapshotAddonWeights(): Record<string, number | null> {
  const snap: Record<string, number | null> = {}
  for (const node of nodesConfig.nodes) {
    for (const [addonId, weight] of Object.entries(node.addons)) {
      snap[`${node.id}|${addonId}`] = weight ?? null
    }
  }
  return snap
}

export function restoreAddonWeights(snap: Record<string, number | null>) {
  for (const node of [...nodesConfig.nodes]) {
    if (Object.keys(node.addons).length === 0) continue
    const nextAddons = { ...node.addons }
    for (const addonId of Object.keys(node.addons)) {
      const key = `${node.id}|${addonId}`
      if (!(key in snap)) continue
      nextAddons[addonId as NodeType] = snap[key]
    }
    replaceNodeConfig(
      new NodeConfig(
        node.id,
        node.label,
        node.level,
        node.color,
        node.factors,
        nextAddons,
        node.minOutput,
        node.co2,
        node.endUse,
        node.residualOf,
        node.factorComments
      )
    )
  }
}

/**
 * Lock calibration addonShares onto sum nodes so interior mixes are enforceable.
 * When exactly one sibling remains unlocked, set it to the complement 1 − lockedSum.
 */
function applyCalibrationShareLocks() {
  const shares = nodesConfig.calibration?.addonShares
  if (!shares) return

  for (const [sumId, shareMap] of Object.entries(shares)) {
    if (!shareMap) continue
    const sum = nodesConfig.nodes.find((n) => n.id === sumId)
    if (!sum || Object.keys(sum.addons).length === 0) continue

    const nextAddons: Partial<Record<NodeType, number | null>> = { ...sum.addons }
    const addonIds = Object.keys(sum.addons) as NodeType[]
    const locked = new Map<NodeType, number>()

    for (const [addonId, spec] of Object.entries(shareMap)) {
      if (!spec) continue
      locked.set(addonId as NodeType, spec.target)
    }

    let lockedSum = 0
    for (const [id, w] of locked) {
      nextAddons[id] = w
      lockedSum += w
    }

    const freeIds = addonIds.filter((id) => !locked.has(id))
    if (freeIds.length === 1) {
      nextAddons[freeIds[0]] = Math.max(0, 1 - lockedSum)
    } else {
      for (const id of freeIds) {
        nextAddons[id] = null
      }
    }

    replaceNodeConfig(
      new NodeConfig(
        sum.id,
        sum.label,
        sum.level,
        sum.color,
        sum.factors,
        nextAddons,
        sum.minOutput,
        sum.co2,
        sum.endUse,
        sum.residualOf,
        sum.factorComments
      )
    )
  }
}

export type CalibrateFactorsResult = {
  baseline: Record<string, number>
  scoreBefore: number
  scoreAfter: number
  diffs: FactorDiff[]
  rounds: number
  evaluations: number
  shareLocksApplied: boolean
}

/**
 * Outer-loop search: nudge TRE factors so a normal objective lands closer to
 * calibration targets. Mix targets are applied as hard addon locks first —
 * otherwise a linear objective stays at 0%/100% corners.
 */
export async function calibrateFactorsToTargets(options?: {
  innerObjective?: SolverObjective
  rounds?: number
  scales?: number[]
  lockShareTargets?: boolean
  onProgress?: (msg: string) => void
}): Promise<CalibrateFactorsResult> {
  const innerObjective = options?.innerObjective ?? 'maximize_free_time'
  const rounds = options?.rounds ?? 6
  const scales = options?.scales ?? [0.85, 0.92, 1.08, 1.15]
  const lockShareTargets = options?.lockShareTargets !== false
  const baseline = snapshotFactors()
  let evaluations = 0

  if (lockShareTargets) {
    applyCalibrationShareLocks()
    options?.onProgress?.('Locked calibration addon shares (policy mixes)')
  }

  const evaluate = async () => {
    evaluations++
    await outputMapSolver(nodesConfig, innerObjective, { quiet: true })
    const status = getStoredSolverResult()?.result?.status
    if (status !== 5) return Number.POSITIVE_INFINITY
    return scoreCalibrationTargets()
  }

  let bestScore = await evaluate()
  const scoreBefore = bestScore
  options?.onProgress?.(`start score=${bestScore.toFixed(6)}`)

  for (let round = 0; round < rounds; round++) {
    let improved = false
    const entries = listFactorEntries()

    for (const entry of entries) {
      const original = entry.value
      if (original <= 0) continue

      for (const scale of scales) {
        const candidate = original * scale
        if (candidate < 1e-4 || candidate > 20) continue

        setNodeFactor(entry.nodeId, entry.inputId, candidate)
        if (getFactorSumFailures(nodesConfig.nodes).length > 0) {
          setNodeFactor(entry.nodeId, entry.inputId, original)
          continue
        }

        const score = await evaluate()
        if (score + 1e-9 < bestScore) {
          bestScore = score
          improved = true
          options?.onProgress?.(
            `round ${round + 1}: ${entry.nodeId}.${entry.inputId} ${original.toFixed(4)}→${candidate.toFixed(4)} score=${score.toFixed(6)}`
          )
          break
        }

        setNodeFactor(entry.nodeId, entry.inputId, original)
      }
    }

    if (!improved) {
      options?.onProgress?.(`round ${round + 1}: no improvement — stop`)
      break
    }
  }

  return {
    baseline,
    scoreBefore,
    scoreAfter: bestScore,
    diffs: diffAgainstBaseline(baseline).filter((d) => Math.abs(d.delta) > 1e-9),
    rounds,
    evaluations,
    shareLocksApplied: lockShareTargets
  }
}

export { snapshotFactors, restoreFactors }
