# Regional Alta Performance

App **loja-cêntrico**: o painel cadastra lojas; o gestor faz check-in/out em `/performance`.

## URLs (GitHub Pages)

- Painel admin: https://islasmendes.github.io/regional/painel
- App do gestor: https://islasmendes.github.io/regional/performance

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

1. Ative **Authentication → E-mail/senha** (obrigatório)
2. Anônimo é opcional e **não** abre dados de loja nas regras
3. Publique as regras do RTDB (`firebase/database.rules.json`) — republicar após mudanças

## Ordem de evolução

1. Base do app ✅
2. Painel — senha mestra + criar/excluir/redefinir lojas ✅
3. Auth do gestor em `/performance` ✅ (login; input IN/OUT na sequência)
4. KPIs + config de check
5. Input check-in/out
6. Matriz + sistema + acuracidade

## Segurança

Não versionar `serviceAccountKey.json`. URL privada ≠ segurança: Auth + regras do RTDB controlam o acesso. Anônimo autenticado sem e-mail master/loja continua bloqueado.
