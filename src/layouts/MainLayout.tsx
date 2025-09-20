import { AppSidebar } from '@/components/AppSidebar';
import Header from '@/components/Header';
import {
  SidebarProvider,
  SidebarInset,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { ThemeProvider } from '@/providers/ThemeProvider';
import React, { ReactNode, useEffect, useState } from 'react';

// Define sidebar width constants to keep them in sync
const CUSTOM_SIDEBAR_WIDTH = 15;
const CUSTOM_SIDEBAR_WIDTH_MOBILE = CUSTOM_SIDEBAR_WIDTH;
const CUSTOM_SIDEBAR_WIDTH_ICON = 4; // Match the 4rem from AppSidebar

const MainLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider>
      <SidebarProvider 
      defaultOpen={true}
      style={{
        "--sidebar-width": `${CUSTOM_SIDEBAR_WIDTH}rem`,
        "--sidebar-width-mobile": `${CUSTOM_SIDEBAR_WIDTH_MOBILE}rem`,
        "--sidebar-width-icon": `${CUSTOM_SIDEBAR_WIDTH_ICON}rem`,
      } as React.CSSProperties}
      >
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <AppSidebar overlayOnExpand={false} />
          <SidebarRail />
          <SidebarInset className="flex flex-col">
            <Header />
            <div className="flex-1 p-4 md:p-6 overflow-auto">
              {children}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
};

export default MainLayout;
