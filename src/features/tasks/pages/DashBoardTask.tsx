import axios from 'axios';
import React, { useState, useEffect } from 'react';
import AGGrid from '@/components/Tables/AGGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList } from 'lucide-react';
import api from '@/api/whagonsApi';

export const DashBoardTask = () => {
  // State to store the fetched data
  const [data, setData] = useState(null);

  // State to handle loading state
  const [loading, setLoading] = useState(true);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(
          'http://localhost:8000/api/protected',
          {
            withCredentials: true,
          },
        );
        setData(response.data); // Set the fetched data into state
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false); // Set loading to false after the fetch completes
      }
    };

    fetchData();
  }, []); // Empty dependency array ensures it runs only once when the component mounts

  if (loading) {
    return <div>Loading...</div>; // Show loading message while fetching data
  }

  return (
    <Tabs defaultValue="grid" className="w-full h-full">
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
        className='h-full'
        value="grid">
        <AGGrid />
      </TabsContent>
      <TabsContent value="list">
        <div>What's good?</div>
      </TabsContent>
    </Tabs>


  );
};
