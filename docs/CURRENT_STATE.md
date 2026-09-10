# CURRENT STATE

VERSION: 0.5.3  
CURRENT_PHASE: MVP VENDÁVEL + PRIMEIRA VENDA  
CURRENT_TASK: APP-010 — Converter primeiro piloto e publicar ambiente operacional  
LAST_COMPLETED: demo e oferta públicas; CI aprovado; 8/8 testes locais; 3 contatos comerciais anteriores por Gmail; lote BARBER-MOC-001 com 5 leads pesquisados, 4 mensagens diagnóstico-first e CRM mínimo registrados  
BLOCKERS: HUMAN_GATE Cloudflare — autorizar conta para criar D1, configurar SETUP_KEY, aplicar migrações e publicar Worker; HUMAN_GATE WhatsApp — vincular WhatsApp Business antes dos 4 contatos do lote; depois testar onboarding → login → reserva → painel em produção  
NEXT_ACTION: concluir os dois HUMAN_GATES; publicar backend; executar E2E remoto; obter confirmação de envio antes das mensagens externas; cobrar somente após ativação operacional validada  
SALES_ASSETS: demo https://bthurlerm-lgtm.github.io/barbearia-aplicativo-/ ; oferta https://bthurlerm-lgtm.github.io/barbearia-aplicativo-/oferta.html ; Plano Fundador R$99/mês; playbook docs/SALES_LAUNCH.md; pipeline docs/SALES_CURRENT_STATE.md  
COMMERCIAL_STATUS: Barbearia Maxx Shop, Barbearia Aragone e JB Studio de Beleza e Barbearia foram contatadas por Gmail em 2026-09-10. BARBER-MOC-001 está pronto, mas nenhuma mensagem desse lote foi enviada.  
PRODUCT_TRUTH: demonstração estática funciona e está claramente marcada; produção operacional ainda não está publicada; venda só como piloto fundador em implantação até o E2E remoto passar  
FILES_CHANGED: docs/SALES_CURRENT_STATE.md, docs/SALES_EXPERIMENT_LOG.md, docs/SALES_WIN_LOSS.md, docs/SALES_MESSAGE_LIBRARY.md, docs/SALES_LAUNCH.md, oferta.html, .github/workflows/pages.yml, .github/workflows/ci.yml, package.json, package-lock.json, wrangler.toml, migrations/, worker/, admin.html, manage.html, setup.html, src/, test/, docs/CURRENT_STATE.md, docs/EXECUTION_BOARD.md, docs/ARCHITECTURE.md, README.md  
DECISIONS:
- Cloudflare Workers + D1: menor infraestrutura suficiente e free-first
- isolamento reforçado por tenant_id e chaves estrangeiras compostas
- disponibilidade calculada no backend a partir de expediente, duração, bloqueios e reservas
- prevenção de conflito ocorre por triggers SQLite em INSERT e UPDATE, não no frontend
- catálogo público expõe somente tenant ativo e seus próprios registros
- produtos, combos, planos mensal/trimestral e prioridade configurável já possuem modelo persistente
- nenhuma credencial secreta no frontend
- painel permite agenda, indicadores, status, remarcação, bloqueio e gestão de cadastros
- onboarding protegido por SETUP_KEY cria tenant e proprietário sem novo código
- OWNER administra; BARBER só acessa sua própria agenda e ações operacionais
- GitHub Pages publica somente demonstração e oferta comercial, sem painel, banco ou segredos
- CI roda npm run check em cada push/PR no main
- cobrança inicial pode usar Pix/WhatsApp; pagamentos internos permanecem P1
- próximos contatos usam diagnóstico-first; demo e preço somente após interesse, dor confirmada ou pergunta direta
- venda deste momento é piloto fundador em implantação; não afirmar que agenda real já está online
