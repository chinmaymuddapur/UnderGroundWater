import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import AppShell from './components/AppShell';
import Overview from './pages/Overview';
import LiveMonitoring from './pages/LiveMonitoring';
import GroundwaterAnalysis from './pages/GroundwaterAnalysis';
import WaterQuality from './pages/WaterQuality';
import AlertsEvents from './pages/AlertsEvents';
import SimulationLab from './pages/SimulationLab';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Overview />} />
            <Route path="monitoring" element={<LiveMonitoring />} />
            <Route path="groundwater" element={<GroundwaterAnalysis />} />
            <Route path="quality" element={<WaterQuality />} />
            <Route path="alerts" element={<AlertsEvents />} />
            <Route path="simulation" element={<SimulationLab />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
