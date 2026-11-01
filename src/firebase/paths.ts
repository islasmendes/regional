export const MASTER_EMAIL_DOMAIN = 'regionalaltaperformance.firebaseapp.com'

export function masterEmail(): string {
  return `master@${MASTER_EMAIL_DOMAIN}`
}

export function lojaEmail(sigla: string): string {
  const slug = sigla.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `loja.${slug}@${MASTER_EMAIL_DOMAIN}`
}

export function masterConfigPath(): string {
  return 'master/config'
}

/** Ordem/classificação das abas do painel (raiz, compartilhada). */
export function masterUiTabsPath(): string {
  return 'master/ui/tabs'
}

/**
 * Isolamento por sigla (única):
 * stores/{SIGLA}/meta
 * stores/{SIGLA}/kpis
 * stores/{SIGLA}/config/...
 * stores/{SIGLA}/managerChecks/{yyyy-MM}/entries
 * stores/{SIGLA}/results/{yyyy-MM}/...
 */
export function storeRootPath(sigla: string): string {
  return `stores/${sigla.toUpperCase()}`
}

export function storeMetaPath(sigla: string): string {
  return `${storeRootPath(sigla)}/meta`
}

export function storeKpisPath(sigla: string): string {
  return `${storeRootPath(sigla)}/kpis`
}

export function storeKpiPath(sigla: string, kpiId: string): string {
  return `${storeKpisPath(sigla)}/${kpiId}`
}

export function storeKpiSubsPath(sigla: string, kpiId: string): string {
  return `${storeKpiPath(sigla, kpiId)}/subs`
}

export function storeKpiSubPath(sigla: string, kpiId: string, subId: string): string {
  return `${storeKpiSubsPath(sigla, kpiId)}/${subId}`
}

export function storeMetasMonthPath(sigla: string, monthKey: string): string {
  return `${storeRootPath(sigla)}/metas/${monthKey}`
}

export function storeKpiMetaPath(sigla: string, monthKey: string, kpiId: string): string {
  return `${storeMetasMonthPath(sigla, monthKey)}/${kpiId}`
}

export function storeSubMetaPath(
  sigla: string,
  monthKey: string,
  kpiId: string,
  subId: string,
): string {
  return `${storeKpiMetaPath(sigla, monthKey, kpiId)}/subs/${subId}`
}

export function storeConfigPath(sigla: string, leaf = ''): string {
  const base = `${storeRootPath(sigla)}/config`
  return leaf ? `${base}/${leaf}` : base
}

export function storeManagerChecksPath(sigla: string, monthKey: string): string {
  return `${storeRootPath(sigla)}/managerChecks/${monthKey}/entries`
}

export function storeResultsPath(sigla: string, monthKey: string): string {
  return `${storeRootPath(sigla)}/results/${monthKey}`
}

export function storesIndexPath(): string {
  return 'stores'
}

/** Índice auxiliar de unicidade (espelha a existência da loja). */
export function siglaIndexPath(sigla: string): string {
  return `indexes/siglas/${sigla.toUpperCase()}`
}
