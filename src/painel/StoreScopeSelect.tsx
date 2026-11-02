import {
  STORE_SCOPE_ALL,
  isStoreScopeAll,
  type StoreScope,
} from '../lib/storeScope'
import type { StoreMeta } from '../firebase/types'
import { ThemeSelect } from '../ui/ThemeSelect'

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
      <ThemeSelect
        label="Loja"
        value={value}
        onChange={(next) => onChange(next as StoreScope)}
        options={[
          { value: STORE_SCOPE_ALL, label: 'TODOS (todas as lojas)' },
          ...stores.map((store) => ({
            value: store.code,
            label: store.active === false ? `${store.code} (inativa)` : store.code,
          })),
        ]}
      />
      <p className="painel-hint painel-scope-hint">{allHint}</p>
    </div>
  )
}
