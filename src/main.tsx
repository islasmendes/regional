import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { appBasename, restoreRedirectFromSession } from './lib/routing'
import './index.css'

restoreRedirectFromSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={appBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
