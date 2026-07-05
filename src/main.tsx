import '@fontsource-variable/inter/index.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { createContainer } from './app/container'
import { ContainerProvider } from './app/container-context'

void createContainer().then((container) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ContainerProvider container={container}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ContainerProvider>
    </StrictMode>,
  )
})
