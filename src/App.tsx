import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { AppRouter } from './router/AppRouter'

import { PersistGate } from 'redux-persist/integration/react' 
import { persistor, store } from './store';
import { useEffect } from 'react';
import { api, web } from './api';
import { auth } from './firebase/firebaseConfig';


export const App = () => {

    const user = auth.currentUser;




    return (
        <BrowserRouter>
            <Provider store={store}>
                <PersistGate loading={null} persistor={persistor}>
                    <AppRouter />
                </PersistGate>
            </Provider>
        </BrowserRouter>
    )
}

export default App;