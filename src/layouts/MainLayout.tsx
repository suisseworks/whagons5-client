import { AppSidebar } from '@/components/AppSidebar';
import Header from '@/components/Header';
import {
  SidebarProvider,
  SidebarInset,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { ThemeProvider } from '@/providers/ThemeProvider';
import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import AssistantWidget from '@/components/AssistantWidget';

// Define sidebar width constants to keep them in sync
const CUSTOM_SIDEBAR_WIDTH = 15;
const CUSTOM_SIDEBAR_WIDTH_MOBILE = CUSTOM_SIDEBAR_WIDTH;
const CUSTOM_SIDEBAR_WIDTH_ICON = 4; // Match the 4rem from AppSidebar

const MainLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isWelcome = (location.pathname === '/home' && new URLSearchParams(location.search).has('welcome')) || location.pathname === '/welcome';
  
  const savedPinnedStr = localStorage.getItem('sidebarPinned');
  const hasSaved = savedPinnedStr !== null;
  const defaultOpenValue = hasSaved ? savedPinnedStr === 'true' : true;
  
  if (isWelcome) {
    return (
      <ThemeProvider>
        <div className="h-screen w-screen overflow-hidden">
          {children}
        </div>
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <SidebarProvider 
        defaultOpen={defaultOpenValue}
        style={{
          "--sidebar-width": `${CUSTOM_SIDEBAR_WIDTH}rem`,
          "--sidebar-width-mobile": `${CUSTOM_SIDEBAR_WIDTH_MOBILE}rem`,
          "--sidebar-width-icon": `${CUSTOM_SIDEBAR_WIDTH_ICON}rem`,
        } as React.CSSProperties}
      >
        <div className="flex h-screen w-full overflow-hidden bg-background">
          {!isWelcome && <AppSidebar overlayOnExpand={false} />}
          {!isWelcome && <SidebarRail />}
          <SidebarInset className="flex flex-col">
            {!isWelcome && <Header />}
            <div className={`${isWelcome ? 'flex-1 p-0 overflow-hidden' : 'flex-1 p-4 md:p-6 overflow-auto'}`}>
              {children}
              <AssistantWidget />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
};

export default MainLayout;
