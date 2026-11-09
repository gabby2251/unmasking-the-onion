const { runSimulation } = require('../js/correlation_sim.js');
const base={numBins:100};
const scen = {
  'Short window baseline': {},
  'Short + jitter 10': {jitter:10},
  'Short + jitter 25': {jitter:25},
  'Short + cover 6': {coverRate:6},
  'Short + 49 others': {otherUsers:49},
  'Short + 49 others + jitter 25': {otherUsers:49, jitter:25},
  'Short + 49 others + jitter 25 + cover 6': {otherUsers:49, jitter:25, coverRate:6},
  'LONG(1600) + 49 others + jitter 25 + cover 6': {numBins:1600, otherUsers:49, jitter:25, coverRate:6},
};
for (const [name, set] of Object.entries(scen)) {
  let ranks=[], tScore=0, margin=0; const N=100;
  for (let seed=1; seed<=N; seed++) {
    const r = runSimulation({...base,...set, seed});
    const t = r.candidates.find(c=>c.isTarget);
    ranks.push(r.targetRank); tScore+=t.score; margin+=r.margin;
  }
  const top1 = ranks.filter(x=>x===1).length/N;
  const avgRank = ranks.reduce((a,b)=>a+b)/N;
  console.log(name.padEnd(46), 'score', (tScore/N).toFixed(2), 'margin', (margin/N).toFixed(2), 'top1', (top1*100).toFixed(0)+'%', 'avgRank', avgRank.toFixed(1));
}
