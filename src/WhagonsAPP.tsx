import { BrowserRouter } from 'react-router'
import { Provider } from 'react-redux'


import { AppRouter } from './router/AppRouter'
import { store, persistor } from './store'
import { PersistGate } from 'redux-persist/integration/react'


export const WhagonsAPP = () => {
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
