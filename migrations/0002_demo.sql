INSERT INTO tenants (id, slug, name, address, whatsapp) VALUES ('ten_demo', 'demo-barbearia', 'Barbearia', 'Montes Claros - MG', '5538999999999');
INSERT INTO barbers (id, tenant_id, name, specialties) VALUES
  ('bar_rafael', 'ten_demo', 'Rafael', '["Fade","Barba"]'),
  ('bar_lucas', 'ten_demo', 'Lucas', '["Social","Tesoura"]');
INSERT INTO services (id, tenant_id, name, duration_min, price_cents) VALUES
  ('srv_corte', 'ten_demo', 'Corte', 45, 4500),
  ('srv_barba', 'ten_demo', 'Barba', 30, 3500),
  ('srv_combo', 'ten_demo', 'Corte + Barba', 70, 7000);
INSERT INTO products (id, tenant_id, name, description, price_cents, stock_qty) VALUES
  ('prd_pomada', 'ten_demo', 'Pomada modeladora', 'Finalização sem brilho', 3900, 12),
  ('prd_balm', 'ten_demo', 'Balm para barba', 'Hidratação diária', 4500, 8);
INSERT INTO bundles (id, tenant_id, name, description, price_cents) VALUES
  ('bun_corte_barba', 'ten_demo', 'Corte + Barba', 'Combo completo', 7000);
INSERT INTO plans (id, tenant_id, name, billing_period, price_cents, validity_days, uses_limit, priority_days) VALUES
  ('pln_2cortes', 'ten_demo', 'Clube 2 Cortes', 'MONTHLY', 7900, 31, 2, 2),
  ('pln_trimestral', 'ten_demo', 'Clube Trimestral', 'QUARTERLY', 21900, 93, 6, 3);
INSERT INTO availability_rules (id, tenant_id, barber_id, weekday, start_time, end_time)
SELECT 'avr_' || b.id || '_' || d.weekday, 'ten_demo', b.id, d.weekday, '09:00', '20:00'
FROM barbers b CROSS JOIN (SELECT 1 weekday UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) d
WHERE b.tenant_id = 'ten_demo';

