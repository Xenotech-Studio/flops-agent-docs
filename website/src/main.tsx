import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Router from './Router'
import { localeFor } from './i18n'
import './styles.css'
import './VisualPolish.css'
import './HeaderExperiment.css'
import './Typography.css'
import './Theme.css'

document.documentElement.lang = localeFor(location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
