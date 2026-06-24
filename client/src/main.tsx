import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 2000,
        style: {
          background: '#1f2937',
          color: '#f9fafb',
          fontSize: '13px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      }}
    />
  </StrictMode>,
)
