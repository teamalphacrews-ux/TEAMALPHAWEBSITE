import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/brand.css'
import './native/nativeWorkspace.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

import { AuthProvider } from './context/AuthContext'

import { Provider } from 'react-redux';
import { store } from './store/store';

createRoot(document.getElementById('root'), {
  // Keep a diagnostic signal without exposing exception details or client data.
  onCaughtError: () => console.error("Studio OS recovered a page-render error."),
}).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AuthProvider>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
