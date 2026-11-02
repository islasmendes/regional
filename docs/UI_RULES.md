# Regras de UI (obrigatórias)

## 1. Blocos responsivos (largura fluida)

- Todo `.painel-panel`, card de aba e bloco de página usa **100% da largura útil**.
- Proibido `max-width` estreito em conteúdo de aba (ex.: 40rem/52rem) — isso deixa “faixa vazia” na direita.
- Grids internos: `repeat(auto-fit, minmax(min(100%, …), 1fr))`.
- Novas abas/páginas **devem** seguir esta regra desde o primeiro commit.

## 2. Escopo de loja: padrão TODOS

- Configurações operacionais (KPI, horários, e futuras iguais) usam `StoreScopeSelect`.
- **Padrão = `TODOS`**: a alteração grava em **todas** as lojas ativas.
- Só escolhe uma sigla quando for **exceção** pontual.
- Componente: `src/painel/StoreScopeSelect.tsx` + helpers em `src/lib/storeScope.ts`.
