import axios from 'axios';
import React, { useState, useEffect } from 'react';
import TankStack from '../../../components/Tables/TankStack';
import AGGrid from '../../../components/Tables/AGChart';

export const DashBoardTicket = () => {
  // State to store the fetched data
  const [data, setData] = useState(null);

  // State to handle loading state
  const [loading, setLoading] = useState(true);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
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
    <div className='h-full w-full'>
      {/* <h1>DashBoardTicket</h1> */}
      {/* <pre>{JSON.stringify(data, null, 2)}</pre>{' '} */}
      {/* Display the fetched data */}
      <AGGrid/>
    </div>
  );
};
