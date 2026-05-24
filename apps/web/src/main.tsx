import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { TaskPage } from './pages/TaskPage';
import { ScorePage } from './pages/ScorePage';
import { ResultPage } from './pages/ResultPage';
import { DashboardPage } from './pages/DashboardPage';
import { installMockServer } from './mockServer';
import './styles.css';

// Static / demo mode: when the SPA is served from GitHub Pages (no Node
// backend behind it), intercept fetch() and serve read-only API responses
// from a baked-in dataset. Vite always populates import.meta.env.MODE
// with the value of `--mode` (or 'production'/'development' by default).
if (import.meta.env.MODE === 'static-demo') {
  installMockServer();
}

// Note: there is no React route for /all on purpose. /all is a pure JSON
// endpoint served by the Node backend (apps/cli/src/server.ts). Humans who
// want a live view of a session go to /dashboard instead.

// Vite's import.meta.env.BASE_URL is '/' for local dev and '/browser-agent-chaos/'
// for the Pages build. Strip trailing slash for react-router basename.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseUrl = ((import.meta as any).env?.BASE_URL ?? '/') as string;
const basename = baseUrl === '/' ? undefined : baseUrl.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* `:token` is the opaque "r_…" task URL token. TaskPage resolves it
            against /api/resolve/:token to discover (sessionId, challengeId). */}
        <Route path="/task/:token" element={<TaskPage />} />
        <Route path="/score/:sessionId" element={<ScorePage />} />
        <Route
          path="/score/:sessionId/:challengeId"
          element={<ResultPage />}
        />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
