# Barbearia App

MVP multi-tenant mobile-first para agendamento confiável, catálogo e receita recorrente de barbearias.

## Executar
```bash
npm install
npm run db:local
npm run dev
```

Abra `http://localhost:8787`.

## Validar
```bash
npm run check
```

## Estrutura
- `src/` — booking público
- `worker/` — API e regras de negócio
- `migrations/` — D1/SQLite
- `test/` — testes automatizados
- `docs/` — estado e decisões

## Produção
Antes do deploy, crie o banco D1, substitua `LOCAL_OR_REPLACE_AFTER_CREATE` pelo ID real e aplique as migrações.

