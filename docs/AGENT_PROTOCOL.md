# AGENT PROTOCOL

## Ordem de retomada
1. CURRENT_STATE.md
2. EXECUTION_BOARD.md
3. somente arquivos da tarefa atual
4. último changelog relevante, se existir
5. MASTER_EXECUTION_PLAN.md apenas quando necessário

## Token Governor
- Econômico/Instant: leitura curta, CSS, UI simples, docs, CRUD, mocks, testes triviais.
- Medium: lógica, persistência, integrações, agenda, testes importantes.
- High: arquitetura crítica, segurança, pagamentos, concorrência/double booking, debugging difícil.

## Handoff
[TASK-ID]
FROM:
TO:
STATUS:
OBJECTIVE:
INPUTS:
OUTPUT:
FILES:
TESTS:
RISKS:
NEXT:

## Regra
Nenhum agente deve reler o projeto inteiro quando o estado atual já estiver consolidado.
