import { useMemo } from 'react';
import { TrainingChart } from './grafity';
import { Generation } from './function/create_null';

export default function App() {
  // Раньше Generation() вызывался на КАЖДЫЙ рендер: 1M новых точек => график пересоздавался
  const data = useMemo(() => Generation(), []);

  return (
    <div style={{ padding: '20px', background: '#121212', minHeight: '100vh', color: '#fff' }}>
      <h1>Soup Training Monitor</h1>
      <p>Всего точек в данных: {data.length.toLocaleString()}</p>
      <TrainingChart data={data} />
    </div>
  );
}
