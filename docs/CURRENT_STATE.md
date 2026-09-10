# CURRENT STATE

VERSION: 0.5.2  
CURRENT_PHASE: MVP VENDÁVEL + PRIMEIRA VENDA  
CURRENT_TASK: APP-010 — Converter primeiro piloto e publicar ambiente operacional  
LAST_COMPLETED: demo pública publicada; landing comercial criada; CI automático criado e aprovado; 3 primeiros contatos comerciais enviados por Gmail; sistema comercial do JARVIS Pedido Direto analisado e adaptado em docs/SALES_LAUNCH.md; APP-003/004/005 persistência e booking confiável; APP-006 painel; APP-007 autenticação/permissões; APP-008 eventos mínimos; APP-009 onboarding  
BLOCKERS: somente produção operacional Cloudflare ainda depende de HUMAN_GATE — criar D1 remoto, substituir database_id, aplicar migrações, definir segredo SETUP_KEY e publicar Worker. Cobrança inicial pode seguir por Pix/WhatsApp enquanto pagamentos internos ficam em P1.  
NEXT_ACTION: prospecção passa a usar diagnóstico-first: sinal público → 1 pergunta operacional → dor confirmada → demo → oferta → fechamento. Em paralelo concluir HUMAN_GATE Cloudflare e depois executar teste ponta a ponta em produção.  
SALES_ASSETS: demo https://bthurlerm-lgtm.github.io/barbearia-aplicativo-/ ; oferta https://bthurlerm-lgtm.github.io/barbearia-aplicativo-/oferta.html ; plano fundador R$99/mês; playbook docs/SALES_LAUNCH.md.  
COMMERCIAL_STATUS: primeiros contatos enviados para Barbearia Maxx Shop, Barbearia Aragone e JB Studio de Beleza e Barbearia em 2026-09-10. Esses três foram abordagem anterior mais direta; próximos contatos usam diagnóstico-first e não recebem landing/preço antes de interesse, salvo se perguntarem.  
FILES_CHANGED: docs/SALES_LAUNCH.md, oferta.html, .github/workflows/pages.yml, .github/workflows/ci.yml, package.json, package-lock.json, wrangler.toml, migrations/, worker/, admin.html, manage.html, setup.html, src/, test/, docs/CURRENT_STATE.md, docs/EXECUTION_BOARD.md, docs/ARCHITECTURE.md, README.md  
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
- GitHub Pages publica somente demonstração e oferta comercial, sem painel, banco ou segredos
- CI roda npm run check em cada push/PR no main
- venda não deve aguardar pagamentos internos; primeiro recebimento pode usar Pix/WhatsApp
- prospecção usa uma pergunta por vez e só avança para demo/oferta após sinal de interesse ou dor confirmada
- resposta automática não conta como interesse e lead com solução equivalente satisfatória sai da prioridade
