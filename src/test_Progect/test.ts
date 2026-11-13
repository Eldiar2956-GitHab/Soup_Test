import assert from 'node:assert/strict';
import test from 'node:test';
import DownsampleData, { Generation, normalizeSeries, toChartArrays, type DataPoint } from '../function/create_null.ts';

const strictlyAscending = (a: DataPoint[]) => a.every((p, i) => i === 0 || p.step > a[i - 1].step);

test('small data is returned as is (same reference)', () => {
  const d: DataPoint[] = [{ step: 0, loss: 2 }, { step: 1, loss: 1 }];
  assert.strictEqual(DownsampleData(d, 2), d);
});

test('min and max of a block come out in STEP order, both orderings (reviewer finding #1)', () => {
  // блок: max раньше min
  const a: DataPoint[] = [{ step: 0, loss: 5 }, { step: 1, loss: 1 }, { step: 2, loss: 3 }, { step: 3, loss: 3 }];
  // блок: min раньше max
  const b: DataPoint[] = [{ step: 0, loss: 1 }, { step: 1, loss: 5 }, { step: 2, loss: 3 }, { step: 3, loss: 3 }];
  assert.deepEqual(DownsampleData(a, 1).map(p => p.step), [0, 1, 3]);
  assert.deepEqual(DownsampleData(b, 1).map(p => p.step), [0, 1, 3]);
  assert.ok(strictlyAscending(DownsampleData(a, 1)) && strictlyAscending(DownsampleData(b, 1)));
});

test('property: output steps always ascending on random data with NaN', () => {
  const d: DataPoint[] = Array.from({ length: 20000 }, (_, i) => ({ step: i, loss: Math.random() < 0.01 ? NaN : Math.random() }));
  for (const t of [7, 100, 1000]) assert.ok(strictlyAscending(DownsampleData(d, t)));
});

test('NaN survives downsampling and becomes a gap (null), never 0 (reviewer finding #2)', () => {
  const d: DataPoint[] = Array.from({ length: 10000 }, (_, i) => ({ step: i, loss: 1 + (i % 7) * 0.01 }));
  d[4000] = { step: 4000, loss: NaN };
  const out = DownsampleData(d, 100);
  assert.ok(out.some(p => Number.isNaN(p.loss)), 'NaN point lost in downsampling');
  const { ys, markers } = toChartArrays(out);
  assert.ok(ys.includes(null));
  assert.ok(!ys.includes(0));
  assert.deepEqual(markers, [{ step: 4000, kind: 'nan' }]);
});

test('boundaries of a NaN run are kept exactly (gap is not widened)', () => {
  const d: DataPoint[] = Array.from({ length: 10000 }, (_, i) => ({ step: i, loss: 2 - i * 1e-4 }));
  for (let i = 3000; i < 3100; i++) d[i] = { step: i, loss: NaN };
  const out = DownsampleData(d, 50);
  const steps = new Set(out.map(p => p.step));
  assert.ok(steps.has(2999) && steps.has(3000) && steps.has(3099) && steps.has(3100));
});

test('Infinity is kept and flagged separately from NaN', () => {
  const d: DataPoint[] = Array.from({ length: 5000 }, (_, i) => ({ step: i, loss: 1 }));
  d[2500] = { step: 2500, loss: Infinity };
  const { markers } = toChartArrays(DownsampleData(d, 50));
  assert.deepEqual(markers, [{ step: 2500, kind: '+inf' }]);
});

test('unsorted steps and duplicates are normalized and reported', () => {
  const d: DataPoint[] = [
    { step: 3, loss: 3 }, { step: 1, loss: 1 }, { step: 2, loss: 2 },
    { step: 2, loss: 2.5 }, { step: 1, loss: 1 }, { step: NaN, loss: 9 },
  ];
  const { data, report } = normalizeSeries(d);
  assert.deepEqual(data, [{ step: 1, loss: 1 }, { step: 2, loss: 2.5 }, { step: 3, loss: 3 }]);
  assert.equal(report.wasUnsorted, true);
  assert.equal(report.duplicatesRemoved, 2);
  assert.equal(report.conflictingDuplicates, 1);
  assert.equal(report.droppedBadStep, 1);
});

test('spike at step 500000 is visible at EVERY zoom level, from full range to 10 steps', () => {
  const full = Generation();
  const { data } = normalizeSeries(full);
  const spike = { step: 500000, loss: 999.99 };

  assert.ok(DownsampleData(data, 1000).some(p => p.step === spike.step && p.loss === spike.loss), 'overview');
  for (const width of [1_000_000, 100_000, 10_000, 1_000, 100, 10]) {
    const range = { min: 500000 - width / 2, max: 500000 + width / 2 };
    const out = DownsampleData(data, 1000, range);
    assert.equal(Math.max(...out.map(p => p.loss)), 999.99, `spike lost at zoom width ${width}`);
    assert.ok(out.length <= 2 * 1000 + 2, `too many points at width ${width}: ${out.length}`);
  }
});

test('window that does not contain the spike must NOT show it (no phantom values)', () => {
  const { data } = normalizeSeries(Generation());
  const out = DownsampleData(data, 1000, { min: 100000, max: 200000 });
  assert.ok(Math.max(...out.map(p => p.loss)) < 5);
});

test('global min and max of the real data are exactly present in the output', () => {
  const { data } = normalizeSeries(Generation());
  const out = DownsampleData(data, 1000);
  const mm = (a: DataPoint[]) => { let lo = Infinity, hi = -Infinity; for (const p of a) { if (p.loss < lo) lo = p.loss; if (p.loss > hi) hi = p.loss; } return [lo, hi]; };
  assert.deepEqual(mm(out), mm(data)); // spread (...) на 1M элементов падает со stack overflow, поэтому цикл
});

test('Generation creates 1,000,001 points with the marked spike', () => {
  const d = Generation();
  assert.equal(d.length, 1_000_001);
  assert.equal(d[500_000].loss, 999.99);
  assert.ok(d.every(p => Number.isFinite(p.loss) && p.loss >= 0.01));
});