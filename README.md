# Regional Alta Performance

App do **gestor de loja**: check-in / check-out diário, alimentando o painel.

## URLs (GitHub Pages)

- Input do gestor: https://islasmendes.github.io/regional/performance
- Base do app: `/regional/`

## Stack

- Vite + React + TypeScript
- Firebase project: `regionalaltaperformance`
- Realtime Database: `https://regionalaltaperformance-default-rtdb.firebaseio.com`

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Ordem de evolução

1. Base (este commit) — rotas + Firebase
2. Auth do gestor (sigla + senha)
3. KPIs + config de check
4. Input check-in/out em `/performance`
5. Painel matriz
6. Resultado do sistema + acuracidade

## Segurança

Não versionar `serviceAccountKey.json` (Admin SDK). A chave web do Firebase é pública por design; o acesso real é controlado pelas regras do RTDB/Auth.
