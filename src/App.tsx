import { MantineProvider } from '@mantine/core';
import { Routes, Route } from 'react-router-dom';
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
      <Routes>
        <Route path="/" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </MantineProvider>
  );
}

export default App;
