import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { appConfig } from '@/config/env';
import '@/styles/index.css';

const container = document.getElementById('root');

if (!container) {
  // Cannot render without the mount node from index.html.
  throw new Error('Root element #root was not found in the document.');
}

document.title = appConfig.appName;

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
