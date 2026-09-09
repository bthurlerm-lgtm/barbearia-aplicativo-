# CURRENT STATE

VERSION: 0.3.0  
CURRENT_PHASE: MVP VENDÁVEL + PRIMEIRA VENDA  
CURRENT_TASK: APP-006 — Painel mínimo da barbearia  
LAST_COMPLETED: APP-003 persistência multi-tenant, APP-004 motor de disponibilidade, APP-005 proteção transacional contra double booking  
BLOCKERS: D1 remoto ainda precisa ser criado/configurado; demo pública, painel, onboarding, autenticação completa e cobrança ainda precisam ser concluídos  
NEXT_ACTION: implementar painel operacional mobile-first usando a API autenticada; depois APP-007  
FILES_CHANGED: package.json, package-lock.json, wrangler.toml, migrations/, worker/, src/, test/, docs/CURRENT_STATE.md, docs/EXECUTION_BOARD.md, docs/ARCHITECTURE.md, README.md  
DECISIONS:
- Cloudflare Workers + D1: menor infraestrutura suficiente e free-first
- isolamento reforçado por tenant_id e chaves estrangeiras compostas
- disponibilidade calculada no backend a partir de expediente, duração, bloqueios e reservas
- prevenção de conflito ocorre por triggers SQLite em INSERT e UPDATE, não no frontend
- catálogo público expõe somente tenant ativo e seus próprios registros
- produtos, combos, planos mensal/trimestral e prioridade configurável já possuem modelo persistente
- nenhuma credencial secreta no frontend
- publicação remota depende de HUMAN_GATE para criar/vincular o D1

