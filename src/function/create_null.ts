export interface DataPoint {
  step: number;
  loss: number;
}
 
export interface NormalizeReport {
  input: number;
  output: number;
  droppedBadStep: number;
  duplicatesRemoved: number;
  conflictingDuplicates: number;
  wasUnsorted: boolean;
  badLossCount: number;
}
 
export interface BadMarker {
  step: number;
  kind: 'nan' | '+inf' | '-inf';
}
 
// Тестовые данные: 1 run, 1M точек, один выброс посередине
export function Generation(): DataPoint[] {
  const data: DataPoint[] = [];
  let currentLoss = 2.5;
  for (let i = 0; i <= 1000000; i++) {
    currentLoss = Math.max(0.01, currentLoss - 0.000001 + (Math.random() - 0.5) * 0.001);
    data.push({ step: i, loss: i === 500000 ? 999.99 : currentLoss });
  }
  return data;
}
 
// Первый индекс, где step >= x (данные уже отсортированы)
function lowerBound(data: DataPoint[], x: number): number {
  let lo = 0, hi = data.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (data[mid].step < x) lo = mid + 1; else hi = mid;
  }
  return lo;
}
 
/**
 * Приводит данные к строго возрастающим step.
 * Правило для дубликатов: остаётся ПОСЛЕДНЯЯ запись (позже залогирована).
 * Ничего не скрывается молча: всё считается в report.
 */
export function normalizeSeries(data: DataPoint[]): { data: DataPoint[]; report: NormalizeReport } {
  const countBad = (arr: DataPoint[]) => arr.reduce((n, p) => n + (Number.isFinite(p.loss) ? 0 : 1), 0);
 
  let clean = data.length === 0 || Number.isFinite(data[0].step);
  for (let i = 1; clean && i < data.length; i++) {
    if (!(data[i].step > data[i - 1].step)) clean = false;
  }
  if (clean) {
    return {
      data,
      report: { input: data.length, output: data.length, droppedBadStep: 0, duplicatesRemoved: 0,
        conflictingDuplicates: 0, wasUnsorted: false, badLossCount: countBad(data) },
    };
  }
 
  let wasUnsorted = false;
  for (let i = 1; i < data.length; i++) if (data[i].step < data[i - 1].step) { wasUnsorted = true; break; }
 
  const valid = data.filter(p => Number.isFinite(p.step));
  const sorted = valid.slice().sort((a, b) => a.step - b.step); // стабильная сортировка
  const out: DataPoint[] = [];
  let dup = 0, conflict = 0;
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && last.step === p.step) {
      dup++;
      if (!Object.is(last.loss, p.loss)) conflict++;
      out[out.length - 1] = p;
    } else out.push(p);
  }
  return {
    data: out,
    report: { input: data.length, output: out.length, droppedBadStep: data.length - valid.length,
      duplicatesRemoved: dup, conflictingDuplicates: conflict, wasUnsorted, badLossCount: countBad(out) },
  };
}
 
const kindOf = (v: number) => (Number.isFinite(v) ? 0 : Number.isNaN(v) ? 1 : v > 0 ? 2 : 3);
 
/**
 * Min/max-даунсэмплинг. ВХОД ДОЛЖЕН БЫТЬ после normalizeSeries.
 * targetSize = число корзин; на выходе <= 2*targetSize точек (+ границы NaN/Inf-участков).
 * range — видимое окно по step: при зуме пересчитываем из исходных данных, а не из уже прореженных.
 * Сохраняет: min и max каждой корзины (в порядке step), границы каждого NaN/Inf-участка,
 * первую и последнюю точки окна.
 */
export default function DownsampleData(
  data: DataPoint[],
  targetSize: number = 1000,
  range?: { min: number; max: number },
): DataPoint[] {
  let lo = 0, hi = data.length;
  if (range) {
    lo = Math.max(0, lowerBound(data, range.min) - 1);
    hi = Math.min(data.length, lowerBound(data, range.max + 1e-9) + 1);
  }
  const n = hi - lo;
  if (n <= 0) return [];
  if (n <= targetSize) return lo === 0 && hi === data.length ? data : data.slice(lo, hi);
 
  const mask = new Uint8Array(n);
  const blockSize = Math.ceil(n / Math.max(1, targetSize));
  let prevKind = kindOf(data[lo].loss);
 
  for (let start = 0; start < n; start += blockSize) {
    const end = Math.min(n, start + blockSize);
    let minI = -1, maxI = -1;
    for (let j = start; j < end; j++) {
      const v = data[lo + j].loss;
      const k = kindOf(v);
      if (k !== prevKind) { mask[j] = 1; if (j > 0) mask[j - 1] = 1; prevKind = k; }
      if (k !== 0) continue;
      if (minI < 0 || v < data[lo + minI].loss) minI = j;
      if (maxI < 0 || v > data[lo + maxI].loss) maxI = j;
    }
    if (minI >= 0) { mask[minI] = 1; mask[maxI] = 1; }
  }
  mask[0] = 1; mask[n - 1] = 1;
 
  const out: DataPoint[] = [];
  for (let j = 0; j < n; j++) if (mask[j]) out.push(data[lo + j]); // индексы растут => step растёт
  return out;
}
 
/** NaN/Inf -> null (разрыв линии), и отдельно список маркеров, чтобы разрыв не был невидимым */
export function toChartArrays(points: DataPoint[]): {
  xs: number[]; ys: (number | null)[]; markers: BadMarker[];
} {
  const xs: number[] = [], ys: (number | null)[] = [], markers: BadMarker[] = [];
  for (const p of points) {
    xs.push(p.step);
    if (Number.isFinite(p.loss)) ys.push(p.loss);
    else {
      ys.push(null);
      markers.push({ step: p.step, kind: Number.isNaN(p.loss) ? 'nan' : p.loss > 0 ? '+inf' : '-inf' });
    }
  }
  return { xs, ys, markers };
}
 