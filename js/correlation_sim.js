/*
 * correlation_sim.js
 * Unmasking the Onion - Module 3: Traffic Correlation Lab (core logic)
 * Gabriella Campos, CprE 5300, Fall 2026
 *
 * Simulates SYNTHETIC traffic entering Tor (seen near the guard) and
 * leaving Tor (seen near the exit) for several users, then scores how
 * similar each exit-side flow is to one entry-side flow.
 *
 * IMPORTANT (shown on the page): the score measures how alike two traffic
 * patterns look. It is NOT the probability that a person is identified.
 * Real correlators such as DeepCorr [9] and DeepCoFFEA [11] are far stronger.
 *
 * Design choices grounded in research:
 *  - Flows are compared only by timing and volume (packets per time bin),
 *    because correlation needs no access to encrypted content [9].
 *  - The attacker's score searches across time offsets (lags), because real
 *    correlators align flows in time; this is why a CONSTANT delay barely
 *    helps the defender while random JITTER does (see README / report).
 *  - Cover traffic is added only on the client-to-guard link and dropped
 *    before the exit, modeling link padding: it changes what the entry
 *    observer sees without changing what the exit observer sees.
 *  - Correlation is a matching problem among many candidate flows [8], [11],
 *    so the lab ranks all candidates instead of scoring one pair.
 *
 * No DOM code here; the page (lab.html) calls runSimulation() and draws the
 * returned series with D3.js in the polish phase.
 */

// ---------- Seeded random numbers (reproducible runs) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Poisson sample (Knuth's method; fine for the small rates used here)
function poisson(rand, lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}

// ---------- Traffic generation ----------
/*
 * A user's traffic as packet timestamps (in bins). Browsing is bursty:
 * the user alternates between ON periods (page loads) and OFF periods.
 */
function generateUserPackets(rand, numBins, opts) {
  const { burstRate = 6, onProb = 0.15, meanOnLen = 6 } = opts;
  const packets = [];
  let on = false;
  let remaining = 0;
  for (let t = 0; t < numBins; t++) {
    if (!on && rand() < onProb) {
      on = true;
      remaining = 1 + Math.floor(rand() * meanOnLen * 2);
    }
    if (on) {
      const n = poisson(rand, burstRate);
      for (let i = 0; i < n; i++) packets.push(t + rand()); // spread within bin
      remaining--;
      if (remaining <= 0) on = false;
    }
  }
  return packets;
}

// Count packets per bin -> time series
function binPackets(packets, numBins) {
  const series = new Array(numBins).fill(0);
  for (const p of packets) {
    const b = Math.floor(p);
    if (b >= 0 && b < numBins) series[b]++;
  }
  return series;
}

/*
 * Transform packets as they cross Tor toward the exit.
 *  baseLatency: network delay every packet has (bins)
 *  constantDelay: extra FIXED delay added by a defender (bins)
 *  jitter: max RANDOM extra delay per packet, uniform in [0, jitter] (bins)
 */
function crossTor(rand, packets, { baseLatency, constantDelay, jitter }) {
  return packets.map((p) => p + baseLatency + constantDelay + rand() * jitter);
}

// Dummy packets on the client-guard link (dropped before the exit)
function coverPackets(rand, numBins, coverRate) {
  const packets = [];
  for (let t = 0; t < numBins; t++) {
    const n = poisson(rand, coverRate);
    for (let i = 0; i < n; i++) packets.push(t + rand());
  }
  return packets;
}

// ---------- Scoring ----------
function pearson(x, y) {
  const n = x.length;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

/*
 * Similarity score: best Pearson correlation between the entry series and
 * the exit series shifted by 0..maxLag bins. Returns { score, lag }.
 * With maxLag = 0 this is a "naive" observer that assumes no delay.
 */
function similarity(entry, exit, maxLag) {
  let best = { score: -1, lag: 0 };
  for (let lag = 0; lag <= maxLag; lag++) {
    const a = entry.slice(0, entry.length - lag);
    const b = exit.slice(lag);
    const r = pearson(a, b);
    if (r > best.score) best = { score: r, lag };
  }
  return best;
}

// ---------- Main entry point used by the page ----------
/*
 * settings (all controllable from the lab UI):
 *  otherUsers     number of other users whose exit flows are candidates
 *  coverRate      dummy packets per bin added on the target's guard link
 *  constantDelay  fixed extra delay in bins
 *  jitter         max random per-packet delay in bins
 *  numBins        length of the observation (bins of 50 ms by default)
 *  maxLag         how far the attacker searches in time (bins)
 *  seed           random seed so a run can be repeated exactly
 */
function runSimulation(settings = {}) {
  const s = {
    otherUsers: 4,
    coverRate: 0,
    constantDelay: 0,
    jitter: 0,
    numBins: 400,
    maxLag: 40,
    baseLatency: 3,
    seed: 42,
    ...settings,
  };
  const rand = mulberry32(s.seed);
  const delays = {
    baseLatency: s.baseLatency,
    constantDelay: s.constantDelay,
    jitter: s.jitter,
  };

  // Target user: entry side sees real + cover; exit side sees real only
  const targetReal = generateUserPackets(rand, s.numBins, {});
  const entryPackets = targetReal.concat(coverPackets(rand, s.numBins, s.coverRate));
  const entrySeries = binPackets(entryPackets, s.numBins);

  const candidates = [];
  candidates.push({
    id: "User A (target)",
    isTarget: true,
    exitSeries: binPackets(crossTor(rand, targetReal, delays), s.numBins),
  });
  for (let i = 0; i < s.otherUsers; i++) {
    const other = generateUserPackets(rand, s.numBins, {});
    candidates.push({
      id: "User " + String.fromCharCode(66 + i),
      isTarget: false,
      exitSeries: binPackets(crossTor(rand, other, delays), s.numBins),
    });
  }

  for (const c of candidates) {
    const smart = similarity(entrySeries, c.exitSeries, s.maxLag);
    const naive = similarity(entrySeries, c.exitSeries, 0);
    c.score = smart.score;
    c.bestLag = smart.lag;
    c.naiveScore = naive.score;
  }
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const targetRank = ranked.findIndex((c) => c.isTarget) + 1;
  const runnerUp = ranked.find((c) => !c.isTarget);
  const target = candidates[0];

  return {
    settings: s,
    entrySeries,
    candidates: ranked,
    targetRank,
    // Gap between the target and the best wrong candidate: a large gap means
    // the attacker can pick the target confidently; near zero means confusion.
    margin: target.score - runnerUp.score,
  };
}

// Allow use in the browser (global) and in Node (tests)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { runSimulation, similarity, pearson, mulberry32 };
} else {
  window.CorrelationLab = { runSimulation };
}
