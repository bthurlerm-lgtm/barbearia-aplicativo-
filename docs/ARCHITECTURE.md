# ARCHITECTURE

## Stack do MVP
- frontend mobile-first em HTML/CSS/JS sem framework;
- API em Cloudflare Worker;
- persistência relacional em Cloudflare D1;
- migrações SQL versionadas;
- testes de domínio e invariantes com `node:test` + SQLite.

## Camadas
- `src/`: apresentação pública;
- `worker/index.js`: aplicação, API e integrações;
- `worker/domain.js`: regras puras de agenda;
- `migrations/`: persistência e invariantes;
- `test/`: disponibilidade, isolamento e conflito.

## Invariantes
- todo dado operacional carrega `tenant_id`;
- referências compostas impedem cruzamento acidental entre tenants;
- nenhuma credencial secreta fica no frontend;
- horário só confirma após escrita no banco;
- triggers no banco rejeitam sobreposição do mesmo barbeiro em reservas PENDING/CONFIRMED;
- cancelamento libera o intervalo;
- duração do serviço participa do cálculo do término e conflito.

## Publicação
Criar D1, substituir `database_id` em `wrangler.toml`, aplicar migrações e publicar o Worker. Esta ação exige conta Cloudflare do proprietário.

