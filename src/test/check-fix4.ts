import generateEnergyGraph from "../types/energyGraphGenerator"
const g = await generateEnergyGraph("maximize_leisure")

const colRight = Math.max(...g.energyNodes.filter(n=>n.level.id==="primary"||(n.x>1300&&n.x<1700)).map(n=>n.x+n.width))
const tertLeft = Math.min(...g.energyNodes.filter(n=>n.level.id==="tertiary").map(n=>n.x))
console.log("gap", (tertLeft-colRight).toFixed(1))

const segs=[]
for (const c of g.connectors) {
  if (c.strokeWidth < 0.5) continue
  const h=c.strokeWidth/2, p=c.points
  const add=(id,x,y0,y1)=>segs.push({id,x0:x-h,x1:x+h,y0:Math.min(y0,y1),y1:Math.max(y0,y1)})
  if (p.length===12) { add(c.id+":srcV",p[2],p[3],p[5]); add(c.id+":appV",p[6],p[7],p[9]) }
  else if (p.length===8||p.length===10) add(c.id+":midV",p[2],p[3],p[5])
  else if (p.length===6) add(c.id+":dumpV",p[2],p[3],p[5])
}
let o=[], appO=[]
for (let i=0;i<segs.length;i++) for (let j=i+1;j<segs.length;j++) {
  const a=segs[i], b=segs[j]
  if (a.id.split(":")[0]===b.id.split(":")[0]) continue
  if (a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0) {
    const ox=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)
    const oy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0)
    if (ox>1&&oy>1) {
      o.push([a.id,b.id,+ox.toFixed(1)])
      if (a.id.includes("appV")||b.id.includes("appV")) appO.push([a.id,b.id,+ox.toFixed(1)])
    }
  }
}
console.log("total vert overlaps", o.length)
console.log("appV overlaps", appO.length, appO)
console.log("other sample", o.filter(x=>!x[0].includes("appV")&&!x[1].includes("appV")).slice(0,10))

// approach corridor vs everything for tertiary
const apps=g.connectors.filter(c=>c.points.length===12 && g.energyNodes.find(n=>n.id===c.to)?.level.id==="tertiary")
console.log("tert approaches", apps.map(c=>({id:c.id,ax:c.points[6].toFixed(1),sw:c.strokeWidth.toFixed(1),ty:c.points[9].toFixed(1)})))
