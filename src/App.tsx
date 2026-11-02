import { Navigate, Route, Routes } from 'react-router-dom'
import { GestorAuthProvider } from './auth/GestorAuthContext'
import { MasterAuthProvider } from './auth/MasterAuthContext'
import { CalculadoraPage } from './pages/CalculadoraPage'
import { PainelPage } from './pages/PainelPage'
import { PerformancePage } from './pages/PerformancePage'

export default function App() {
  return (
    <MasterAuthProvider>
      <GestorAuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/painel" replace />} />
          <Route path="/painel" element={<PainelPage />} />
          <Route path="/painel/*" element={<PainelPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/performance/*" element={<PerformancePage />} />
          <Route path="/calculadora" element={<CalculadoraPage />} />
          <Route path="/calculadora/*" element={<CalculadoraPage />} />
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Routes>
      </GestorAuthProvider>
    </MasterAuthProvider>
  )
}
