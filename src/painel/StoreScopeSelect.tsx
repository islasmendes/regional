import {
  STORE_SCOPE_ALL,
  isStoreScopeAll,
  type StoreScope,
} from '../lib/storeScope'
import type { StoreMeta } from '../firebase/types'

type Props = {
  stores: StoreMeta[]
  value: StoreScope
  onChange: (scope: StoreScope) => void
  /** Texto curto sob o select. */
  hint?: string
}

/**
 * Regra global do painel: padrão = TODOS (aplica em todas as lojas).
 * Só restringe quando o usuário escolhe uma sigla.
 */
export function StoreScopeSelect({ stores, value, onChange, hint }: Props) {
  const allHint =
    hint ??
    (isStoreScopeAll(value)
      ? `Alterações valem para todas as ${stores.length} loja(s). Escolha uma sigla só se quiser exceção.`
      : `Escopo só em ${value}. Volte para TODOS para aplicar em todas.`)

  return (
    <div className="painel-scope">
      <label>
        Loja
        <select value={value} onChange={(e) => onChange(e.target.value as StoreScope)}>
          <option value={STORE_SCOPE_ALL}>TODOS (todas as lojas)</option>
          {stores.map((store) => (
            <option key={store.code} value={store.code}>
              {store.code}
              {store.active === false ? ' (inativa)' : ''}
            </option>
          ))}
        </select>
      </label>
      <p className="painel-hint painel-scope-hint">{allHint}</p>
    </div>
  )
}
