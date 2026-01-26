const nodes = ['ptr', 'coal', 'fuel', 'elc', 'min', 'man', 'tran', 'wb', 'lei']

const bound: string[] = []

for (const nodeOrigin of nodes) {
  bound.push(`x-${nodeOrigin}`)
  for (const nodeDestination of nodes) {
    if (nodeOrigin === nodeDestination) continue
    bound.push(`f-${nodeOrigin}-${nodeDestination}`)
  }
}

console.log(bound)
