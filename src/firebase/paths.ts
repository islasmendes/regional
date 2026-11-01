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

export function storeRootPath(sigla: string): string {
  return `stores/${sigla.toUpperCase()}`
}

export function storeMetaPath(sigla: string): string {
  return `${storeRootPath(sigla)}/meta`
}

export function storesIndexPath(): string {
  return 'stores'
}
