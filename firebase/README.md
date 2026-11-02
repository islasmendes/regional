# Firebase — Regional Alta Performance

## Setup no Console

1. **Authentication → Sign-in method**
   - **E-mail/senha → Ativar** (obrigatório para painel e gestor)
   - **Anônimo** pode ficar ligado se quiser (projeto interno).  
     Ele **não** libera leitura/escrita de lojas nas regras atuais.
2. Publique as regras do Realtime Database:

```bash
firebase deploy --only database --project regionalaltaperformance
```

Ou cole `database.rules.json` em Realtime Database → Rules → Publish.

## Contas sintéticas (E-mail/senha)

| Papel  | E-mail |
|--------|--------|
| Master | `master@regionalaltaperformance.firebaseapp.com` |
| Loja   | `loja.{sigla}@regionalaltaperformance.firebaseapp.com` (ex.: `loja.vcant@…`) |

Criar/redefinir loja no **painel** também provisiona a conta Auth da loja (app Firebase secundário).

## Isolamento por sigla

```
master/config
master/ui/tabs          ← ordem/classificação das abas do painel
indexes/siglas/{SIGLA}  ← unicidade
stores/{SIGLA}/meta
stores/{SIGLA}/kpis
stores/{SIGLA}/metas/{yyyy-MM}/...   ← Meta/Alvo mensal (painel)
stores/{SIGLA}/config/...
stores/{SIGLA}/managerChecks/{yyyy-MM}/entries
stores/{SIGLA}/results/{yyyy-MM}/... ← Real override (painel)
```


## Importante

URL “privada” no GitHub Pages **não** é controle de acesso. Quem importa são Auth + regras do RTDB. Anônimo autenticado sem e-mail de master/loja continua bloqueado.

Após mudar `database.rules.json`, **publique de novo** as regras no Console.
