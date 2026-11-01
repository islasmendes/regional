import { Navigate, Route, Routes } from 'react-router-dom'
import { MasterAuthProvider } from './auth/MasterAuthContext'
import { PainelPage } from './pages/PainelPage'
import { PerformancePage } from './pages/PerformancePage'

export default function App() {
  return (
    <MasterAuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/painel" replace />} />
        <Route path="/painel" element={<PainelPage />} />
        <Route path="/painel/*" element={<PainelPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/performance/*" element={<PerformancePage />} />
        <Route path="*" element={<Navigate to="/painel" replace />} />
      </Routes>
    </MasterAuthProvider>
  )
}
