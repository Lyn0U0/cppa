import React from 'react'
import ReactDOM from 'react-dom/client'
import 'antd/dist/reset.css' // 引入 Ant Design 的重置樣式 (Version 5+)
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
