# Gestão de Contratos RSDSU

## Diagnóstico (v4 Excel)

O arquivo `RSDSU_Gestao_Contratos_v4.xlsx` **não está versionado neste repositório**. A implementação web abaixo segue integralmente as regras descritas no briefing operacional (abas, fórmulas, conferência, V+F, VNF, projeção parcial e os dois gaps pós-v4).

### O que a v4 já resolvia (preservado)

- Quatro áreas separadas: importação bruta, base diária, justificativas, gestão de fechamento
- Conferência `vendas = faturamento + abertos`
- Projeção regional parcial (`n/7 lojas`)
- Remoção de `V+F D+7 ATÉ FIM MÊS` e indicadores redundantes
- Campos editáveis vs. calculados
- Formatação condicional de meta / GAP / críticos

### Gaps que motivaram a web

1. **Importação por acréscimo** — linhas residuais quando a nova base é menor
2. **Filtros/ordenação** — risco de desalinhamento justificativa ↔ contrato se a ordenação for só visual
3. Excel Online limita automação atômica, histórico e auditoria

## Arquitetura adotada

Módulo `src/contratos/` no app Regional (Vite + React + Firebase RTDB):

| Camada | Responsabilidade |
|--------|------------------|
| `domain/` | Regras puras: ID estável, importação atômica, recorrência, conferência, projeções, consolidado |
| `parse/` | Leitura Excel/CSV com validação de cabeçalhos |
| `firebase/` | Persistência `contratos/*` (base ativa, justificativas do ciclo, histórico de previsões, fechamento) |
| UI (aba **Contratos**) | Quatro subáreas + botão **IMPORTAR NOVA BASE** |

### Princípio central

1. A base importada é a posição oficial atual (substituição integral).
2. O histórico registra compromissos de previsão anteriores.
3. O painel projeta fechamento sem duplicidade, sem residual e sem números inconsistentes.

### Identificador técnico

`contractKey = primeiroContrato || contratoAtual + '|' + placa` (normalizados).  
A UI do gerente não exibe a chave; ordenação/filtro movem o registro completo.

## Atualização / operação

1. Painel → aba **Contratos** → **Importação** → **IMPORTAR NOVA BASE**
2. Revisar **Base diária** e preencher **Justificativas** do ciclo
3. Lançar metas / vendas / V+F em **Gestão de fechamento**
4. Conferir consolidado regional (parcial ou completo)

Senha de planilha Excel (`gestaoaltaperformance`) é substituída por Auth Firebase (master) + células/campos calculados somente leitura na UI.
