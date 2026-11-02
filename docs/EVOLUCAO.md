# Evolução contínua (PR única)

Tudo que for feature daqui pra frente entra **nesta branch/PR**, até decidirmos publicar no `main` de uma vez.

## Já no ar (main)

1. Base + Firebase ✅
2. Painel (senha mestra + lojas) ✅
3. Login gestor `/performance` ✅
4. Sidebar + abas reordenáveis + isolamento por sigla ✅

## Já mergeado (#4 / #5)

1. KPIs tipados + subs + meta mensal + Horários + input gestor ✅
2. Layout fluido + escopo **TODOS** ✅

## Em andamento

1. Controles no tema (select / hora / flags) — sem nativos ✅
2. Aba **Matriz** (lojas × KPIs) ✅
3. Override de resultado no painel + acuracidade
4. Blocos de aderência

## Modelo de indicador

| Tipo | Matriz | Meta mensal | IN/OUT |
|------|--------|-------------|--------|
| **volume** | Meta · Real · Proj% | Sim (`metas/{mês}`) | Independente (só IN, só OUT, ou ambos) |
| **conversao** | Só conversão (A ÷ B) | Não | Geralmente off — calculado |
| **alvo** (ex. NPS) | Alvo · Real | Sim (campo “Alvo”) | Real via check-out |

Subs ficam em `kpis/{id}/subs/{subId}` e **não precisam** seguir o tipo/IN-OUT do KPI-mãe.

## Regras Firebase

Substituir o JSON inteiro no Console pelo `firebase/database.rules.json` e Publish (paths novos: `kind`, `formula`, `subs`, `metas`).
