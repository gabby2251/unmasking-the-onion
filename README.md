# Unmasking the Onion: How Tor Crime Is Investigated Across the Network Stack

CprE 5300 Final Project · Gabriella Campos · Fall 2026

## Overview

An interactive teaching website with four modules: **How Tor Works**, **Case Files**, **Traffic Correlation Lab**, and **Profile the Suspect**. This repository holds the core logic and analysis scripts. Page content is documented in the Research & Content Development report (Appendices A–F).

## Files

| File | Description |
| --- | --- |
| `correlation_sim.js` | Module 3 simulator logic (runs in the browser and in Node.js) |
| `correlation_sim_tests.js` | Runs each lab setting over 100 seeds and prints the results |
| `capture_summary.py` | Summarizes a home-lab Tor capture from a local observer's view |

> Canvas copies of these files use the `.txt` extension. Rename them to `.js` / `.py` to run.

## Dependencies

- Node.js 18+ (no npm packages needed)
- Python 3.10+, `pyshark` (`pip install pyshark`), and Wireshark/`tshark` on your PATH
- For captures: VirtualBox with an isolated Ubuntu VM, and Tor Browser
- Site: a modern browser; D3.js v7 loaded from a CDN (polish phase)

## Run the simulator tests

1. Put `correlation_sim.js` and `correlation_sim_tests.js` in the same folder.
2. Run:

   ```bash
   node correlation_sim_tests.js
   ```

For each setting, the output shows the average similarity score for the target user, the average margin over the best wrong candidate, the percentage of runs where the target ranked first, and the average rank.

## Use the simulator in a page

```html
<script src="correlation_sim.js"></script>
<script>
  const r = window.CorrelationLab.runSimulation({
    otherUsers: 49,
    jitter: 10,
    coverRate: 3,
    constantDelay: 0,
    numBins: 100,
    seed: 7,
  });
</script>
```

Returned values:

- `r.candidates`: ranked list of `{ id, isTarget, score, naiveScore, bestLag, exitSeries }`
- `r.entrySeries`, `r.targetRank`, `r.margin`

Units: 1 bin = 50 ms. `jitter` and `constantDelay` are in bins.

## Summarize a capture

```bash
python3 capture_summary.py tor_session.pcapng --bin-ms 50 --out entry_series.csv
```

Only capture traffic from your own isolated lab VM.

## Notes

- All traffic in the simulator is synthetic.
- The similarity score shows how alike two traffic patterns look. It is **not** the probability of identifying a person.
- No credentials are required for any part of this project.
