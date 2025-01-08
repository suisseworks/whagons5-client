import React from 'react'
import { Header } from '../components/Header'
import { Sidebar } from '../components/Sidebar'

import '../styles/MainLayout.css'


interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {

  return (
    <div className="main-layout">
      <Header />
      <div className="main-layout-body">
        <Sidebar />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default MainLayout;
