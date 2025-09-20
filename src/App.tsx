import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router/AppRouter';

// Initialize icon caching
import './database/iconInit';

export const App = () => {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
};

export default App;
