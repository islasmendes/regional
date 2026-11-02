import { Link } from 'react-router-dom'
import { CalculadorasPanel } from '../calculadora/CalculadorasPanel'
import '../calculadora/CalculadorasPanel.css'
import './PainelPage.css'

export function CalculadoraPage() {
  return (
    <main className="calc-page-shell">
      <header className="calc-page-header">
        <div>
          <p className="painel-eyebrow">Ferramentas</p>
          <h1>Calculadora</h1>
          <p>
            Meta, real, YoY, ritmo e conversão — todos os resultados de uma vez. Link direto:{' '}
            <code>/regional/calculadora</code>
          </p>
        </div>
        <Link className="calc-page-link" to="/painel">
          Abrir painel
        </Link>
      </header>
      <CalculadorasPanel />
    </main>
  )
}
