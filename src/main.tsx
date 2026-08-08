import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { PwaToast } from './components/PwaToast'
import '@fontsource/heebo/400.css'
import '@fontsource/heebo/700.css'
import '@fontsource/heebo/900.css'
import './styles/base.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <PwaToast />
  </React.StrictMode>,
)
