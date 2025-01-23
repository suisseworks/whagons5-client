import { useEffect } from 'react';
import { useParams } from 'react-router';


const Dashboard: React.FC = () => {
    const { uuid } = useParams<{ uuid: string }>();

  //on mount print uuid


useEffect(() => {
    console.log(uuid);

}, [uuid]);

  return <>This is dashboard {uuid}</>;
}

export default Dashboard;
