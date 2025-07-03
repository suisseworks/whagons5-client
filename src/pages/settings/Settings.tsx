import { useEffect, useState } from 'react';

function Settings() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    console.log('component mounted');
  }, []);


  
  useEffect(() => {
    console.log('count', count);
  }, [count]);

  return (
    <div>
      <h1 onClick={() => setCount(count + 1)}>Settings {count}</h1>
    </div>
  );
}

export default Settings;
