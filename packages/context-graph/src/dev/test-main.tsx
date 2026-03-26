// Entry point for Playwright e2e test harness
import { createRoot } from 'react-dom/client'
import { TestHarness } from './TestHarness'

const root = createRoot(document.getElementById('root')!)
root.render(<TestHarness />)
