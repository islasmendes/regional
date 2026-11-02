import { STORE_SCOPE_ALL, type StoreScope } from '../lib/storeScope'
import type { StoreMeta } from '../firebase/types'
import { ThemeSelect } from '../ui/ThemeSelect'

type Props = {
  stores: StoreMeta[]
  value: StoreScope
  onChange: (scope: StoreScope) => void
}

/**
 * Regra global do painel: padrão = TODOS (aplica em todas as lojas).
 * Só restringe quando o usuário escolhe uma sigla.
 */
export function StoreScopeSelect({ stores, value, onChange }: Props) {
  return (
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
  )
}
