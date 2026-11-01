import { Navigate, Route, Routes } from 'react-router-dom'
import { PerformancePage } from './pages/PerformancePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/performance" replace />} />
      <Route path="/performance" element={<PerformancePage />} />
      <Route path="/performance/*" element={<PerformancePage />} />
      <Route path="*" element={<Navigate to="/performance" replace />} />
    </Routes>
  )
}
