import { CalculadorasPanel } from '../calculadora/CalculadorasPanel'
import '../calculadora/CalculadorasPanel.css'
import './PainelPage.css'

export function CalculadoraPage() {
  return (
    <main className="calc-page-shell">
      <header className="calc-page-header">
        <div>
          <p className="painel-eyebrow">Acesso livre · sem login</p>
          <h1>Calculadora</h1>
          <p>
            Meta, real, YoY, ritmo e conversão — todos os resultados de uma vez. Link direto:{' '}
            <code>islasmendes.github.io/regional/calculadora</code>
          </p>
        </div>
      </header>
      <CalculadorasPanel />
    </main>
  )
}
