# Firebase — Regional Alta Performance

## Antes de usar o painel

1. No [Firebase Console](https://console.firebase.google.com/project/regionalaltaperformance):
   - **Authentication → Sign-in method → E-mail/senha → Ativar**
   - Desative login anônimo
2. Publique as regras do Realtime Database:

```bash
firebase deploy --only database --project regionalaltaperformance
```

Ou cole o conteúdo de `database.rules.json` em  
Realtime Database → Rules → Publish.

## Contas sintéticas

| Papel  | E-mail                                                    |
|--------|-----------------------------------------------------------|
| Master | `master@regionalaltaperformance.firebaseapp.com`          |
| Loja   | `loja.{sigla}@regionalaltaperformance.firebaseapp.com` (etapa seguinte) |
