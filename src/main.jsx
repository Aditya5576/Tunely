import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initVersionChecker } from './utils/versionCheck'

// Initialize automated hot-update version checker for immediate deployment reflection
initVersionChecker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
