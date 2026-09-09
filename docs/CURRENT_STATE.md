# CURRENT STATE

VERSION: 0.2.0  
CURRENT_PHASE: MVP VENDÁVEL + PRIMEIRA VENDA  
CURRENT_TASK: APP-003 — Persistência, multi-tenancy e motor de disponibilidade  
LAST_COMPLETED: APP-001 scaffold, APP-002 booking visual e FIRST_SALE_SPRINT  
BLOCKERS: backend/persistência real, demo pública, cobrança real e canal comercial ainda precisam ser concluídos antes da venda contar como real  
NEXT_ACTION: implementar base transacional de booking e preparar demo publicável; depois executar piloto local em Montes Claros  
FILES_CHANGED: docs/CURRENT_STATE.md, docs/FIRST_SALE_SPRINT.md  
DECISIONS:
- mobile-first e config-driven
- multi-tenant
- zero/baixo custo primeiro
- produtos, combos e planos mensal/trimestral entram como motor de ticket/recorrência
- prioridade de agenda será benefício configurável de plano
- primeira venda só conta com aceite + pagamento confirmado
- automação alvo >=95% dos processos repetitivos
- não escalar prospecção antes de demo e booking confiáveis
