import { Route, Routes } from 'react-router-dom'
import { GestorAuthProvider } from './auth/GestorAuthContext'
import { MasterAuthProvider } from './auth/MasterAuthContext'
import { CalculadoraPage } from './pages/CalculadoraPage'
import { EntryRedirect } from './pages/EntryRedirect'
import { PainelPage } from './pages/PainelPage'
import { PerformancePage } from './pages/PerformancePage'

export default function App() {
  return (
    <MasterAuthProvider>
      <GestorAuthProvider>
        <Routes>
          {/* Calculadora é pública: nunca passar por login do painel. */}
          <Route path="/calculadora" element={<CalculadoraPage />} />
          <Route path="/calculadora/*" element={<CalculadoraPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/performance/*" element={<PerformancePage />} />
          <Route path="/painel" element={<PainelPage />} />
          <Route path="/painel/*" element={<PainelPage />} />
          <Route path="/" element={<EntryRedirect />} />
          <Route path="/index.html" element={<EntryRedirect />} />
          <Route path="*" element={<EntryRedirect />} />
        </Routes>
      </GestorAuthProvider>
    </MasterAuthProvider>
  )
}
