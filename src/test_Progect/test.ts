import assert from 'node:assert/strict';
import test from 'node:test';
import DownsampleData, { Generation, type DataPoint } from '../function/create_null.ts';

test('DownsampleData returns the original data when it is already small enough', () => {
  const data: DataPoint[] = [
    { step: 0, loss: 2 },
    { step: 1, loss: 1 },
  ];

  assert.strictEqual(DownsampleData(data, 2), data);
});

test('DownsampleData keeps each block minimum and maximum, including a final partial block', () => {
  const data: DataPoint[] = [
    { step: 0, loss: 5 },
    { step: 1, loss: 1 },
    { step: 2, loss: 4 },
    { step: 3, loss: 2 },
    { step: 4, loss: 3 },
  ];

  assert.deepEqual(DownsampleData(data, 2), [
    { step: 1, loss: 1 },
    { step: 0, loss: 5 },
    { step: 3, loss: 2 },
    { step: 2, loss: 4 },
    { step: 4, loss: 3 },
  ]);
});

test('Generation creates one million and one indexed points and includes the marked spike', () => {
  const data = Generation();

  assert.equal(data.length, 1_000_001);
  assert.equal(data[0].step, 0);
  assert.ok(Number.isFinite(data[0].loss));
  assert.equal(data[500_000].step, 500_000);
  assert.equal(data[500_000].loss, 999.99);
  assert.equal(data[data.length - 1].step, 1_000_000);
  assert.ok(data.every(point => Number.isFinite(point.loss) && point.loss >= 0.01));
});