import GLPK from 'glpk.js'
// import { loadNodesFromYaml } from '../types/energyGraphGenerator'

const glpk = GLPK()

// const config = loadNodesFromYaml()

const bounds = [
  // Level 1
  { name: 'xp', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xc', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Level 2
  { name: 'xf', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xe', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Level 3
  { name: 'xm', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xi', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xt', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Level 4
  { name: 'xw', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xl', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Flows from petroleum
  { name: 'xpf', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Flows from coal/electricity
  { name: 'xce', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Flows from fuel
  { name: 'xfm', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xft', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xfw', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xfl', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Flows from electricity
  { name: 'xem', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xef', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xei', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xew', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xel', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Flows from Mining
  { name: 'xmi', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xme', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Flows from industry
  { name: 'xiw', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xil', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Flows from transport
  { name: 'xti', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xtw', type: glpk.GLP_DB, lb: 0, ub: 1 },
  { name: 'xtl', type: glpk.GLP_DB, lb: 0, ub: 1 },

  // Flows from welfare
  { name: 'xwl', type: glpk.GLP_DB, lb: 0, ub: 1 }
]

const constraints = [
  // === Fixed sources ===
  { name: 'xp_fixed', vars: [{ name: 'xp', coef: 1 }], bnds: { type: glpk.GLP_FX, lb: 1, ub: 1 } },
  { name: 'xc_fixed', vars: [{ name: 'xc', coef: 1 }], bnds: { type: glpk.GLP_FX, lb: 1, ub: 1 } },

  // === xf = min(1, xpf/1.2, xef/0.01) ===
  {
    name: 'xf_le_1',
    vars: [{ name: 'xf', coef: 1 }],
    bnds: { type: glpk.GLP_UP, ub: 1, lb: -Infinity }
  },
  {
    name: 'xf_le_xpf',
    vars: [
      { name: 'xf', coef: 1 },
      { name: 'xpf', coef: -1 / 1.2 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xf_le_xef',
    vars: [
      { name: 'xf', coef: 1 },
      { name: 'xef', coef: -1 / 0.01 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },

  // === xe = min(1, xce/2.5) ===
  {
    name: 'xe_le_1',
    vars: [{ name: 'xe', coef: 1 }],
    bnds: { type: glpk.GLP_UP, ub: 1, lb: -Infinity }
  },
  {
    name: 'xe_le_xce',
    vars: [
      { name: 'xe', coef: 1 },
      { name: 'xce', coef: -1 / 2.5 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },

  // === xm = min(1, xfm/1, xme/0.25) ===
  {
    name: 'xm_le_1',
    vars: [{ name: 'xm', coef: 1 }],
    bnds: { type: glpk.GLP_UP, ub: 1, lb: -Infinity }
  },
  {
    name: 'xm_le_xfm',
    vars: [
      { name: 'xm', coef: 1 },
      { name: 'xfm', coef: -1 / 1 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xm_le_xme',
    vars: [
      { name: 'xm', coef: 1 },
      { name: 'xme', coef: -1 / 0.25 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },

  // === xi = min(1, xmi/0.2, xei/1.6, xti/0.1) ===
  {
    name: 'xi_le_1',
    vars: [{ name: 'xi', coef: 1 }],
    bnds: { type: glpk.GLP_UP, ub: 1, lb: -Infinity }
  },
  {
    name: 'xi_le_xmi',
    vars: [
      { name: 'xi', coef: 1 },
      { name: 'xmi', coef: -1 / 0.2 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xi_le_xei',
    vars: [
      { name: 'xi', coef: 1 },
      { name: 'xei', coef: -1 / 1.6 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xi_le_xti',
    vars: [
      { name: 'xi', coef: 1 },
      { name: 'xti', coef: -1 / 0.1 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },

  // === xt = min(1, xft) ===
  {
    name: 'xt_le_1',
    vars: [{ name: 'xt', coef: 1 }],
    bnds: { type: glpk.GLP_UP, ub: 1, lb: -Infinity }
  },
  {
    name: 'xt_le_xft',
    vars: [
      { name: 'xt', coef: 1 },
      { name: 'xft', coef: -1 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },

  // === xw = min(1, xfw/0.15, xew/0.2, xiw/0.2, xtw/0.4) ===
  {
    name: 'xw_le_1',
    vars: [{ name: 'xw', coef: 1 }],
    bnds: { type: glpk.GLP_UP, ub: 1, lb: -Infinity }
  },
  {
    name: 'xw_le_xfw',
    vars: [
      { name: 'xw', coef: 1 },
      { name: 'xfw', coef: -1 / 0.15 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xw_le_xew',
    vars: [
      { name: 'xw', coef: 1 },
      { name: 'xew', coef: -1 / 0.2 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xw_le_xiw',
    vars: [
      { name: 'xw', coef: 1 },
      { name: 'xiw', coef: -1 / 0.2 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xw_le_xtw',
    vars: [
      { name: 'xw', coef: 1 },
      { name: 'xtw', coef: -1 / 0.4 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },

  // === xl = min(1, xfl/0.15, xel/0.2, xil/0.2, xtl/0.4, xwl/0.6) ===
  {
    name: 'xl_le_1',
    vars: [{ name: 'xl', coef: 1 }],
    bnds: { type: glpk.GLP_UP, ub: 1, lb: -Infinity }
  },
  {
    name: 'xl_le_xfl',
    vars: [
      { name: 'xl', coef: 1 },
      { name: 'xfl', coef: -1 / 0.15 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xl_le_xel',
    vars: [
      { name: 'xl', coef: 1 },
      { name: 'xel', coef: -1 / 0.2 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xl_le_xil',
    vars: [
      { name: 'xl', coef: 1 },
      { name: 'xil', coef: -1 / 0.2 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xl_le_xtl',
    vars: [
      { name: 'xl', coef: 1 },
      { name: 'xtl', coef: -1 / 0.4 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },
  {
    name: 'xl_le_xwl',
    vars: [
      { name: 'xl', coef: 1 },
      { name: 'xwl', coef: -1 / 0.6 }
    ],
    bnds: { type: glpk.GLP_UP, ub: 0, lb: -Infinity }
  },

  // === Flow conservation ===
  {
    name: 'xp_sum',
    vars: [
      { name: 'xpf', coef: 1 },
      { name: 'xp', coef: -1 }
    ],
    bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
  },
  {
    name: 'xc_sum',
    vars: [
      { name: 'xce', coef: 1 },
      { name: 'xc', coef: -1 }
    ],
    bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
  },
  {
    name: 'xf_sum',
    vars: [
      { name: 'xfm', coef: 1 },
      { name: 'xft', coef: 1 },
      { name: 'xfw', coef: 1 },
      { name: 'xfl', coef: 1 },
      { name: 'xf', coef: -1 }
    ],
    bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
  },
  {
    name: 'xe_sum',
    vars: [
      { name: 'xem', coef: 1 },
      { name: 'xef', coef: 1 },
      { name: 'xei', coef: 1 },
      { name: 'xew', coef: 1 },
      { name: 'xel', coef: 1 },
      { name: 'xe', coef: -1 }
    ],
    bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
  },
  {
    name: 'xm_sum',
    vars: [
      { name: 'xmi', coef: 1 },
      { name: 'xm', coef: -1 }
    ],
    bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
  },
  {
    name: 'xi_sum',
    vars: [
      { name: 'xiw', coef: 1 },
      { name: 'xil', coef: 1 },
      { name: 'xi', coef: -1 }
    ],
    bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
  },
  {
    name: 'xt_sum',
    vars: [
      { name: 'xti', coef: 1 },
      { name: 'xtw', coef: 1 },
      { name: 'xtl', coef: 1 },
      { name: 'xt', coef: -1 }
    ],
    bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
  },
  {
    name: 'xw_sum',
    vars: [
      { name: 'xwl', coef: 1 },
      { name: 'xw', coef: -1 }
    ],
    bnds: { type: glpk.GLP_FX, lb: 0, ub: 0 }
  }
]

const objective = {
  direction: glpk.GLP_MAX,
  name: 'maximize_leisure',
  vars: [{ name: 'xl', coef: 1 }]
}

const lp = {
  name: 'EnergyFlowOptimization',
  objective,
  subjectTo: constraints,
  bounds
}

const result = glpk.solve(lp)

for (const [name, value] of Object.entries(result.result.vars).sort((a, b) =>
  a[0].localeCompare(b[0])
)) {
  console.log(`${name} = ${value}`)
}

console.log('------------')
