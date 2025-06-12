import { AppSidebar } from '@/components/AppSidebar';
import Header from '@/components/Header';
import {
  SidebarProvider,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { ThemeProvider } from '@/hooks/theme-provider';
import React, { ReactNode, useEffect, useState } from 'react';

// Define sidebar width constants to keep them in sync
const CUSTOM_SIDEBAR_WIDTH = 15;
const CUSTOM_SIDEBAR_WIDTH_MOBILE = CUSTOM_SIDEBAR_WIDTH;

const MainContent = ({ children }: { children: ReactNode }) => {
  
  return (
    <main 
      className="flex-1 flex flex-col h-full overflow-auto"
      style={{ 
        // Match the margin to the custom sidebar width
        transition: 'margin-left 0.15s ease-out',
        height: '100%'
      }}
    >
      <Header />
      <div className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
      </div>
    </main>
  );
};

const MainLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider>
      <SidebarProvider 
      defaultOpen={true}
      style={{
        "--sidebar-width": `${CUSTOM_SIDEBAR_WIDTH}rem`,
        "--sidebar-width-mobile": `${CUSTOM_SIDEBAR_WIDTH_MOBILE}rem`,
      } as React.CSSProperties}
      >
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <AppSidebar />
          <SidebarRail />
          <MainContent>{children}</MainContent>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
};

export default MainLayout;
