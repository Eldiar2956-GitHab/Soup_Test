import React, { useEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import DownsampleData, { normalizeSeries, toChartArrays, type DataPoint, type BadMarker } from './function/create_null';

interface ChartProps { data: DataPoint[]; }

const HEIGHT = 300;

export const TrainingChart: React.FC<ChartProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Нормализация (sort + дубликаты) один раз; report показываем пользователю
  const { series, report } = useMemo(() => {
    const r = normalizeSeries(data);
    return { series: r.data, report: r.report };
  }, [data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || series.length === 0) return;

    let markers: BadMarker[] = [];
    let busy = false;

    const build = (range?: { min: number; max: number }): uPlot.AlignedData => {
      const { xs, ys, markers: m } = toChartArrays(DownsampleData(series, 1000, range));
      markers = m;
      return [xs, ys];
    };

    const opts: uPlot.Options = {
      width: el.clientWidth || 600,
      height: HEIGHT,
      title: 'Training Loss Monitor',
      scales: { x: { time: false } },
      series: [
        { label: 'step' },
        { stroke: '#ff6b6b', width: 2, label: 'Loss', spanGaps: false },
      ],
      // Контраст: подписи и оси светлые на тёмном фоне (#333 на #121212 было ~1.5:1)
      axes: [
        { stroke: '#e6e6e6', grid: { stroke: '#3a3a3a' }, ticks: { stroke: '#8a8a8a' } },
        { stroke: '#e6e6e6', grid: { stroke: '#3a3a3a' }, ticks: { stroke: '#8a8a8a' } },
      ],
      hooks: {
        // Зум: пересчитываем из ИСХОДНЫХ данных для видимого окна, а не из уже прореженных
        setScale: [
          (u, key) => {
            if (key !== 'x' || busy) return;
            const { min, max } = u.scales.x;
            if (min == null || max == null) return;
            busy = true;
            const d = build({ min, max });
            u.setData(d, false);
            let lo = Infinity, hi = -Infinity;
            for (const v of d[1] as (number | null)[]) if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; }
            if (lo <= hi) { const pad = (hi - lo || 1) * 0.05; u.setScale('y', { min: lo - pad, max: hi + pad }); }
            busy = false;
          },
        ],
        // NaN/Inf: разрыв линии + янтарная вертикаль, чтобы пропуск не был невидимым
        draw: [
          (u) => {
            const { ctx, bbox } = u;
            ctx.save();
            ctx.strokeStyle = '#ffb000';
            ctx.lineWidth = 2;
            for (const m of markers) {
              const x = Math.round(u.valToPos(m.step, 'x', true));
              if (x < bbox.left || x > bbox.left + bbox.width) continue;
              ctx.beginPath(); ctx.moveTo(x, bbox.top); ctx.lineTo(x, bbox.top + bbox.height); ctx.stroke();
            }
            ctx.restore();
          },
        ],
      },
    };

    const plot = new uPlot(opts, build(), el);
    const ro = new ResizeObserver(() => plot.setSize({ width: el.clientWidth || 600, height: HEIGHT }));
    ro.observe(el);
    return () => { ro.disconnect(); plot.destroy(); };
  }, [series]);

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }} />
      <p style={{ color: '#e6e6e6', fontSize: 14 }}>
        Points: {report.input.toLocaleString()} → {report.output.toLocaleString()} ·
        duplicates removed: {report.duplicatesRemoved} (conflicting: {report.conflictingDuplicates}) ·
        unsorted: {report.wasUnsorted ? 'yes' : 'no'} · NaN/Inf: {report.badLossCount} ·
        amber line = NaN/Inf, line is broken there on purpose
      </p>
    </div>
  );
};
