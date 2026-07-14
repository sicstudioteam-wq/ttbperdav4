import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // Pastikan nama fail komponen utama kau betul (biasanya App.jsx)
import './index.css'

// Pendaftaran fungsi PWA (Progressive Web App)
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)