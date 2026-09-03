import generateEnergyGraph from '../types/energyGraphGenerator'

const g = await generateEnergyGraph()
for (const id of ['petroleum', 'coal', 'fuels', 'thermal_electricity']) {
  const n = g.energyNodes.find((x) => x.id === id)!
  console.log(
    id.padEnd(22),
    'h=' + Math.round(n.height).toString().padStart(4),
    'y=' + Math.round(n.y).toString().padStart(4),
    'bottom=' + Math.round(n.y + n.height).toString().padStart(4)
  )
}
