import { createRoot } from 'react-dom/client'
import { DevApp } from './DevApp'

const root = createRoot(document.getElementById('root')!)
root.render(<DevApp />)
