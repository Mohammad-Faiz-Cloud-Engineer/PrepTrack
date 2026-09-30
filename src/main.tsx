import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/700.css';
import './styles.css';
import App from './App';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
