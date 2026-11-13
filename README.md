# Soup Training Run Monitor (Frontend Internship Task)

A lightweight, high-performance training run monitor built with **React**, **TypeScript**, and **uPlot** to inspect large telemetry datasets (1,000,000+ points) without distorting anomalies or freezing the browser.

---

## 1. Verdict: DON'T SHIP (Yet)

**Would I show this current version to someone deciding whether to stop a $500 training run?**  
**No — DON'T SHIP.**

**Why:**  
While the core rendering engine handles 1,000,000 data points smoothly and preserves the isolated outlier spike (`999.99` at step `500,000`), this prototype is not yet production-ready for critical financial decisions:
1. **Incomplete UI scope:** Due to time constraints, I focused on the core data pipeline and chart truthfulness rather than building the full 20-run list with multi-field sorting/filtering, separate `lr` and `grad_norm` charts, and full keyboard accessibility.
2. **Missing zoom-level re-downsampling:** Currently, downsampling happens once on initial load (`1000` buckets). If a user zooms in deeply on a specific region, the chart needs dynamic re-sampling on the visible viewport range to show raw point-level granularity.

**What I would change first:**  
Implement dynamic viewport-based downsampling on zoom/pan events, add full handling for unsorted/duplicate steps directly in the ingestion pipeline, and complete the multi-metric dashboard (`loss`, `lr`, `grad_norm`).

---

## 2. Data Truthfulness & Automated Tests

To render 1,000,000 points without crashing the DOM, I used **uPlot** (Canvas-based rendering) paired with a custom **Min-Max Downsampling** algorithm. Instead of averaging points (which erases spikes), each bucket explicitly preserves both the local `min` and `max` values.

### What is tested:
- **1M Point Generation & Spike Injection:** Verifies that `Generation()` produces 1,000,001 points and injects the exact outlier (`999.99`) at step `500,000`.
- **Spike Preservation:** Confirms `DownsampleData()` compresses the dataset while guaranteeing the `999.99` spike survives intact.
- **Non-finite Value Handling:** `TrainingChart` converts `NaN` and `Infinity` into `null` via `Number.isFinite()` so uPlot breaks the line rather than plotting fake zeros.
- **Component Rendering:** Smoke tests for `App` and `TrainingChart` mounting and point counters.

### What these tests DO NOT catch:
- **Visual rendering bugs:** Unit tests verify the data arrays passed to uPlot, not whether the Canvas pixels actually drew the spike visibly on screen (e.g., if line width or canvas clipping hides a 1px spike).
- **Dynamic Zoom accuracy:** Tests check the initial downsampled array, not how the chart behaves during interactive user zooming or panning.
- **Duplicate/Unsorted steps:** The current generator produces sequential steps; the pipeline does not yet test or sanitize out-of-order timestamps or duplicate step indices.

---

## 3. Silent Failures Checked

- **Turning `NaN` / `Infinity` into `0`:** Fixed by explicitly mapping non-finite values to `null` before passing data to uPlot (`Number.isFinite(d.loss) ? d.loss : null`), ensuring gaps are visible instead of false drops to zero.
- **Time-axis distortion:** Disabled uPlot's default timestamp parsing (`scales: { x: { time: false } }`) so integer training steps are treated as linear numeric steps rather than Unix timestamps.
- **Smoothing hiding divergence:** Avoided spline/moving-average smoothing on raw data; Min-Max downsampling ensures sudden loss explosions remain sharp and visible.

---

## 4. AI Tools Usage

I used AI assistants (local LLMs and cloud AI) as a pair-programming tool during this task:
- **Where I used AI:** Brainstorming the architecture, setting up `uPlot` configuration options, scaffolding Vitest unit tests, and structuring the Min-Max downsampling logic.
- **What I verified & changed myself:** I caught and fixed uPlot's default `time: true` behavior on the X-axis (which misinterprets step numbers as dates), verified how `Number.isFinite` prevents `NaN` from collapsing to zero, and tested the actual browser behavior with 1M generated points.

---

## 5. What Surprised Me & What Still Concerns Me

**What surprised me:**  
Before this task, I thought building charts was mostly about styling a UI library. Working on this showed me how easily a chart can silently lie—by averaging away a critical spike, turning `NaN` into zero, or lagging the main thread—which could cost real money if an engineer trusts a broken visualization during a live training run.

**What still concerns me:**  
Balancing mathematical honesty with browser memory and frame rates at scale. Even with Canvas rendering and Min-Max downsampling, moving processing off the main thread (via Web Workers) and dynamically recalculating buckets on every zoom event without race conditions or UI stutter remains a challenging engineering problem I want to master next.

---

## Running Locally

```bash
npm install
npm run dev
npm test