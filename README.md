# Regional Alta Performance

App **loja-cêntrico**: o painel cadastra lojas; o gestor faz check-in/out em `/performance`.

## URLs (GitHub Pages)

- Painel admin: https://islasmendes.github.io/regional/painel
- Input do gestor: https://islasmendes.github.io/regional/performance (próxima etapa)

## Stack

- Vite + React + TypeScript
- Firebase: `regionalaltaperformance`
- RTDB: `https://regionalaltaperformance-default-rtdb.firebaseio.com`

## Desenvolvimento

```bash
npm install
npm run dev
```

## Firebase (obrigatório antes do 1º login)

1. Ative **Authentication → E-mail/senha**
2. Publique `firebase/database.rules.json` (ver `firebase/README.md`)

## Ordem de evolução

1. Base do app ✅
2. **Painel** — senha mestra + criar/excluir/redefinir lojas ← atual
3. Auth do gestor em `/performance`
4. KPIs + config de check
5. Input check-in/out
6. Matriz + sistema + acuracidade

## Segurança

Não versionar `serviceAccountKey.json`. Regras do RTDB restringem escrita ao e-mail mestre.
