import { MantineProvider } from '@mantine/core';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import History from './pages/History';
import Settings from './pages/Settings';
import '@mantine/core/styles.css';

function App() {
  return (
    <MantineProvider
      theme={{
        primaryColor: 'blue',
        defaultRadius: 'md',
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/history" replace />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/history" replace />} />
        </Routes>
      </Router>
    </MantineProvider>
  );
}

export default App;
