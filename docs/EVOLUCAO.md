# Evolução contínua (PR única)

Tudo que for feature daqui pra frente entra **nesta branch/PR**, até decidirmos publicar no `main` de uma vez.

## Já no ar (main)

1. Base + Firebase ✅
2. Painel (senha mestra + lojas) ✅
3. Login gestor `/performance` ✅
4. Sidebar + abas reordenáveis + isolamento por sigla ✅

## Nesta PR (#4)

1. Cadastro de KPIs por loja (`stores/{SIGLA}/kpis`) ✅
2. Aba **Horários** — janelas IN/OUT + dias da semana (cards) ✅
3. Input do gestor em `/performance` (IN/OUT do dia, respeitando agenda) ✅
4. Tipos de indicador (volume / conversão / alvo) + IN/OUT por KPI e por sub ✅
5. Subindicadores aninhados no KPI-mãe + fórmula A÷B ✅
6. Meta/alvo mensal em `stores/{SIGLA}/metas/{yyyy-MM}` ✅
7. Matriz no painel + resultado do sistema
8. Blocos de acuracidade / aderência

## Modelo de indicador

| Tipo | Matriz | Meta mensal | IN/OUT |
|------|--------|-------------|--------|
| **volume** | Meta · Real · Proj% | Sim (`metas/{mês}`) | Independente (só IN, só OUT, ou ambos) |
| **conversao** | Só conversão (A ÷ B) | Não | Geralmente off — calculado |
| **alvo** (ex. NPS) | Alvo · Real | Sim (campo “Alvo”) | Real via check-out |

Subs ficam em `kpis/{id}/subs/{subId}` e **não precisam** seguir o tipo/IN-OUT do KPI-mãe.

## Regras Firebase

Substituir o JSON inteiro no Console pelo `firebase/database.rules.json` e Publish (paths novos: `kind`, `formula`, `subs`, `metas`).
