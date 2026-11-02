import { CalculadorasPanel } from '../calculadora/CalculadorasPanel'
import '../calculadora/CalculadorasPanel.css'
import './PainelPage.css'

export function CalculadoraPage() {
  return (
    <main className="calc-page-shell">
      <header className="calc-page-header">
        <p className="painel-eyebrow">Gestão rápida</p>
        <h1>Calculadora</h1>
        <p>Digite meta e real — os cards mostram o restante.</p>
      </header>
      <CalculadorasPanel />
    </main>
  )
}
