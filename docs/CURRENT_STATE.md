# CURRENT STATE

VERSION: 0.5.0  
CURRENT_PHASE: MVP VENDÁVEL + PRIMEIRA VENDA  
CURRENT_TASK: APP-010 — Publicar demo e iniciar piloto  
LAST_COMPLETED: APP-003/004/005 persistência e booking confiável; APP-006 painel; APP-007 autenticação/permissões; APP-008 eventos mínimos; APP-009 onboarding  
BLOCKERS: ativação inicial do GitHub Pages; D1 remoto e segredo SETUP_KEY precisam ser criados na conta Cloudflare; cobrança e canal comercial autorizado ainda pendentes  
NEXT_ACTION: ativar GitHub Pages/Actions para publicar a demonstração; depois criar/vincular D1 e publicar o aplicativo operacional  
FILES_CHANGED: package.json, package-lock.json, wrangler.toml, migrations/, worker/, admin.html, manage.html, setup.html, src/, test/, docs/CURRENT_STATE.md, docs/EXECUTION_BOARD.md, docs/ARCHITECTURE.md, README.md  
DECISIONS:
- Cloudflare Workers + D1: menor infraestrutura suficiente e free-first
- isolamento reforçado por tenant_id e chaves estrangeiras compostas
- disponibilidade calculada no backend a partir de expediente, duração, bloqueios e reservas
- prevenção de conflito ocorre por triggers SQLite em INSERT e UPDATE, não no frontend
- catálogo público expõe somente tenant ativo e seus próprios registros
- produtos, combos, planos mensal/trimestral e prioridade configurável já possuem modelo persistente
- nenhuma credencial secreta no frontend
- publicação remota depende de HUMAN_GATE para criar/vincular o D1
- painel permite agenda, indicadores, status, remarcação, bloqueio e gestão de cadastros
- onboarding protegido por SETUP_KEY cria tenant e proprietário sem novo código
- OWNER administra; BARBER só acessa sua própria agenda e ações operacionais
- GitHub Pages publica somente uma demonstração estática identificada, sem painel, banco ou segredos
