import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import './index.css'
import 'uplot/dist/uPlot.min.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { createContainer } from './app/container'
import { ContainerProvider } from './app/container-context'
import { applyTheme, readTheme } from './app/theme'

applyTheme(readTheme())

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
