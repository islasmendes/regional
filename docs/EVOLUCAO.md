# Evolução contínua (PR única)

Tudo que for feature daqui pra frente entra **nesta branch/PR**, até decidirmos publicar no `main` de uma vez.

## Já no ar (main)

1. Base + Firebase ✅
2. Painel (senha mestra + lojas) ✅
3. Login gestor `/performance` ✅
4. Sidebar + abas reordenáveis + isolamento por sigla ✅

## Nesta PR (#4)

1. Cadastro de KPIs por loja (`stores/{SIGLA}/kpis`) ← em andamento
2. Config de check-in / check-out por indicador (detalhes)
3. Input do gestor em `/performance` (IN/OUT do dia)
4. Matriz no painel + resultado do sistema
5. Blocos de acuracidade / aderência

## Regras Firebase

Sim: no Console, **substituir o JSON inteiro** pelo conteúdo atual de `firebase/database.rules.json` e Publish.  
Não misturar regra velha com pedaços novos — sempre o arquivo completo do repo.
