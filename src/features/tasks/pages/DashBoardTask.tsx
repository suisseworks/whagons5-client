import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList } from 'lucide-react';
import GridExample from '@/components/Tables/AGGridExample';

export const DashBoardTask = () => {
  const [activeTab, setActiveTab] = useState('grid');
  // State to store the fetched data

  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());


  return (
    <Tabs defaultValue="grid" className="w-full h-full" onValueChange={setActiveTab} value={activeTab}>
      <TabsList
        className='w-50 h-15'
      >
        <TabsTrigger value="grid">
          <ClipboardList />
          Tasks
        </TabsTrigger>
        <TabsTrigger value="list">
          Other
        </TabsTrigger>
      </TabsList>
      <TabsContent
        forceMount
        className='h-full'
        value="grid"
        style={{ display: activeTab === 'grid' ? 'block' : 'none' }}
      >
        <GridExample rowCache={rowCache} />
      </TabsContent>
      <TabsContent value="list">
        <div>What's good?</div>
      </TabsContent>
    </Tabs>


  );
};
