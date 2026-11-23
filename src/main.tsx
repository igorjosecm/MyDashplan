import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ProvedorUI } from './components/ui.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProvedorUI>
      <App />
    </ProvedorUI>
  </StrictMode>,
);
