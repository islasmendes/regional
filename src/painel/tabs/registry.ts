export type PainelTabId = 'inicio' | 'lojas' | 'kpis' | 'horarios' | 'abas'

export type PainelTabDef = {
  id: PainelTabId
  label: string
  /** Grupo na raiz — permite classificar depois (ex.: operação, config). */
  group: 'geral' | 'cadastros' | 'sistema'
  description: string
  /** Se false, some da sidebar (ainda pode existir no registry). */
  defaultEnabled: boolean
}

/**
 * Catálogo raiz das abas. Novas abas entram aqui;
 * a ordem efetiva vem de master/ui/tabs (reorganizável).
 */
export const PAINEL_TAB_REGISTRY: readonly PainelTabDef[] = [
  {
    id: 'inicio',
    label: 'Início',
    group: 'geral',
    description: 'Resumo do painel e atalhos.',
    defaultEnabled: true,
  },
  {
    id: 'lojas',
    label: 'Lojas',
    group: 'cadastros',
    description: 'Criar, excluir e senhas — isolamento por sigla VC…',
    defaultEnabled: true,
  },
  {
    id: 'kpis',
    label: 'KPIs',
    group: 'cadastros',
    description: 'Indicadores por loja (check-in / check-out).',
    defaultEnabled: true,
  },
  {
    id: 'horarios',
    label: 'Horários',
    group: 'cadastros',
    description: 'Janelas e dias ativos de check-in / check-out.',
    defaultEnabled: true,
  },
  {
    id: 'abas',
    label: 'Abas',
    group: 'sistema',
    description: 'Ordem e classificação das abas na raiz do painel.',
    defaultEnabled: true,
  },
] as const

export const DEFAULT_TAB_ORDER: PainelTabId[] = PAINEL_TAB_REGISTRY.map((t) => t.id)

export function isPainelTabId(value: string): value is PainelTabId {
  return PAINEL_TAB_REGISTRY.some((t) => t.id === value)
}
