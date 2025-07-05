import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Settings } from 'lucide-react';
import WorkspaceTable from '@/pages/spaces/components/WorkspaceTable';
import SettingsComponent from '@/pages/spaces/components/Settings';

export const Workspace = () => {
  const [activeTab, setActiveTab] = useState('grid');
  // State to store the fetched data

  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());


  return (
    <Tabs defaultValue="grid" className="w-full h-full flex flex-col" onValueChange={setActiveTab} value={activeTab}>
      <TabsList className="w-fit h-12 flex-shrink-0">
        <TabsTrigger value="grid" className="flex items-center gap-2">
          <ClipboardList />
          Tasks
        </TabsTrigger>
        <TabsTrigger value="list" className="flex items-center gap-2">
          <Settings />
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent
        forceMount
        className='flex-1 h-0'
        value="grid"
        style={{ display: activeTab === 'grid' ? 'block' : 'none' }}
      >
        <WorkspaceTable rowCache={rowCache} />
      </TabsContent>
      <TabsContent value="list" className="flex-1 h-0">
        <SettingsComponent />
      </TabsContent>
    </Tabs>


  );
};
