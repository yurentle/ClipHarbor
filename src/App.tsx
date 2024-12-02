import { Routes, Route } from 'react-router-dom';
import Settings from './pages/Settings';
import History from './pages/History';

function App() {
  return (
    <Routes>
      <Route path="/" element={<History />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/history" element={<History />} />
    </Routes>
  );
}

export default App;
