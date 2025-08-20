import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Settings } from 'lucide-react';
import WorkspaceTable from '@/pages/spaces/components/WorkspaceTable';
import SettingsComponent from '@/pages/spaces/components/Settings';
import { Input } from '@/components/ui/input';

export const Workspace = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('grid');
  // State to store the fetched data

  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());
  const [searchText, setSearchText] = useState('');

  // Clear cache when workspace ID changes
  useEffect(() => {
    if (id) {
      console.log(`Switching to workspace ${id}, clearing cache`);
      rowCache.current.clear();
    }
  }, [id]);

  // Handle invalid workspace ID
  if (!id) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Invalid Workspace ID</h2>
          <p className="text-gray-600 mt-2">Please check the URL and try again.</p>
        </div>
      </div>
    );
  }


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
      <div className="flex items-center gap-3 mb-3">
        <Input
          placeholder="Search tasks..."
          className="max-w-sm"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <TabsContent
        forceMount
        className='flex-1 h-0'
        value="grid"
        style={{ display: activeTab === 'grid' ? 'block' : 'none' }}
      >
        <WorkspaceTable rowCache={rowCache} workspaceId={id} searchText={searchText} />
      </TabsContent>
      <TabsContent value="list" className="flex-1 h-0">
        <SettingsComponent />
      </TabsContent>
    </Tabs>


  );
};
