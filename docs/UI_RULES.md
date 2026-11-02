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

## 3. Controles no tema (sem nativos “de sistema”)

- **Proibido** `<select>` nativo, `<input type="time|date">` e pickers do browser em telas do produto.
- Usar `ThemeSelect`, `ThemeTimeField`, `ThemeFlags` em `src/ui/`.
- Novos campos de escolha / hora / calendário **devem** nascer no tema Regional.

## 4. Copy do painel

- Título da aba só no header do `PainelPage` — **não** repetir `h2` com o mesmo nome dentro da aba.
- Sem autoexplicações longas (“Linhas = lojas…”, “Padrão TODOS — …”).
- Sem caminhos internos no frontend (`stores/{SIGLA}/…`, `results/…`, `master/ui/tabs`).
