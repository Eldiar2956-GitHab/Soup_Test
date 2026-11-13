
import React, { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import downsampleData  from './function/create_null'; // Проверь правильность пути

interface DataPoint {
  step: number;
  loss: number;
}

interface ChartProps {
  data: DataPoint[];
}

export const TrainingChart: React.FC<ChartProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);

  // Сжимаем данные до того, как они попадут в рендер
  const downsampledData = downsampleData(data, 1000);

  useEffect(() => {
    if (!containerRef.current) return;

    const steps = downsampledData.map(d => d.step);
    const losses = downsampledData.map(d => Number.isFinite(d.loss) ? d.loss : null);

    const chartData: uPlot.AlignedData = [steps, losses];

    const opts = {
    width: containerRef.current.clientWidth || 600,
      height: 300,
      title: "Training Loss Monitor",
      // Добавляем вот этот блок scales 👇
      scales: {
        x: {
          time: false, // Отключаем режим времени для оси X!
        },
      },
      series: [
        {},
        {
          stroke: "red",
          width: 2,
          label: "Loss",
        }
      ],
      axes: [
        { stroke: "#333" },
        { stroke: "#333" }
      ]
    };

    // Создаем график
    const plot = new uPlot(opts, chartData, containerRef.current);
    uplotRef.current = plot;

    // Обязательная очистка при размонтировании или обновлении данных
    return () => {
      plot.destroy();
    };
  }, [downsampledData]); // Зависим от сжатых данных, чтобы график обновлялся при их изменении

  return <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }} />;
};



