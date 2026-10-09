import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { FeedbackProvider } from './components/Feedback';
import { AIStatusProvider } from './components/AIStatus';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeedbackProvider>
      <AIStatusProvider>
        <App />
      </AIStatusProvider>
    </FeedbackProvider>
  </StrictMode>,
);
