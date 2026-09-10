# EXECUTION BOARD

## P0
- [x] APP-001 Scaffold mínimo
- [x] APP-002 Fluxo visual serviço → barbeiro → horário → confirmação
- [x] APP-003 Persistência e modelo multi-tenant
- [x] APP-004 Motor de disponibilidade
- [x] APP-005 Proteção contra double booking
- [x] APP-006 Painel mínimo da barbearia
- [x] APP-007 Autenticação e permissões
- [x] APP-008 Instrumentação de métricas
- [x] APP-009 Onboarding configurável
- [ ] APP-010 Piloto com primeira barbearia
  - [x] demo pública
  - [x] landing comercial + oferta fundador R$99/mês
  - [x] CI automático aprovado
  - [x] primeiros 3 contatos comerciais enviados
  - [ ] D1 remoto + SETUP_KEY + deploy Worker
  - [ ] teste ponta a ponta em produção
  - [ ] primeiro piloto ativado
  - [ ] primeiro pagamento confirmado

## P1
- [ ] CRM básico
- [ ] lembretes
- [ ] rebooking
- [ ] pagamentos internos no app
- [ ] comissões
- [ ] analytics avançado

## GATE DO MVP
Cliente deve concluir booking em <60s e a barbearia deve operar a agenda sem conflito.

## REGRA COMERCIAL
Não bloquear a primeira venda por pagamentos internos. Cobrança inicial pode ocorrer pelo fluxo comercial Pix/WhatsApp até o módulo de pagamentos entrar em P1.
