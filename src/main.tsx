import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router'
import { WhagonsAPP } from './whagonsAPP'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WhagonsAPP/>
  </React.StrictMode>,
)
