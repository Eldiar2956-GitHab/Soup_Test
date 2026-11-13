import { TrainingChart } from './grafity';
import { Generation } from './function/create_null'; 

export default function App() {
  const millionData = Generation();

  return (
    <div style={{ padding: '20px', background: '#121212', minHeight: '100vh', color: '#fff' }}>
      <h1>Soup Training Monitor</h1>
      <p>Всего точек в данных: {millionData.length.toLocaleString()}</p>
      
      {/* Передаем миллион точек в наш компонент графика */}
      <TrainingChart data={millionData} />
    </div>
  );
}


