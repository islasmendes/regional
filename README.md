# Regional Alta Performance

App **loja-cêntrico**: o painel cadastra lojas; o gestor faz check-in/out em `/performance`.

## URLs (GitHub Pages)

- Painel admin: https://islasmendes.github.io/regional/painel
- App do gestor: https://islasmendes.github.io/regional/performance

### Publicar

1. Repo precisa estar **Public** (no Free, Pages de repo privado dá 404 “Site not found”).
2. **Settings → Pages** → Deploy from a branch → **`gh-pages`** / **`/ (root)`** → Save (só uma vez).
3. A cada push em `main`, o workflow republica automaticamente a branch `gh-pages`.

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

Ver backlog vivo em [`docs/EVOLUCAO.md`](docs/EVOLUCAO.md).  
Novas features entram numa **única PR de evolução** até o próximo publish no `main`.

1. Base do app ✅
2. Painel — senha mestra + criar/excluir/redefinir lojas ✅
3. Auth do gestor em `/performance` ✅
4. Sidebar + abas + isolamento por sigla ✅
5. KPIs por loja ← nesta PR
6. Config de check + input check-in/out
7. Matriz + sistema + acuracidade

## Segurança

Não versionar `serviceAccountKey.json`. URL privada ≠ segurança: Auth + regras do RTDB controlam o acesso. Anônimo autenticado sem e-mail master/loja continua bloqueado.
