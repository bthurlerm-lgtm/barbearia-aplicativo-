import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0001_core.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../migrations/0002_demo.sql", import.meta.url), "utf8"));
  return db;
}

function booking(db, id, startAt, endAt) {
  db.prepare("INSERT INTO customers (id, tenant_id, name, phone) VALUES (?, 'ten_demo', 'Cliente', ?) ").run(`cus_${id}`, `3899999${id.padStart(4, "0")}`);
  db.prepare("INSERT INTO bookings (id, tenant_id, barber_id, service_id, customer_id, start_at, end_at, status, total_cents) VALUES (?, 'ten_demo', 'bar_rafael', 'srv_corte', ?, ?, ?, 'CONFIRMED', 4500)").run(id, `cus_${id}`, startAt, endAt);
}

test("migrações sobem e catálogo inicial existe", () => {
  const db = database();
  assert.equal(db.prepare("SELECT count(*) total FROM tenants").get().total, 1);
  assert.equal(db.prepare("SELECT count(*) total FROM availability_rules").get().total, 12);
  db.close();
});

test("trigger do banco rejeita sobreposição real", () => {
  const db = database();
  booking(db, "one", "2026-09-10T09:00:00", "2026-09-10T09:45:00");
  assert.throws(() => booking(db, "two", "2026-09-10T09:30:00", "2026-09-10T10:15:00"), /BOOKING_CONFLICT/);
  assert.equal(db.prepare("SELECT count(*) total FROM bookings").get().total, 1);
  db.close();
});

test("cancelamento libera o horário", () => {
  const db = database();
  booking(db, "one", "2026-09-10T09:00:00", "2026-09-10T09:45:00");
  db.prepare("UPDATE bookings SET status='CANCELLED' WHERE id='one'").run();
  booking(db, "two", "2026-09-10T09:00:00", "2026-09-10T09:45:00");
  assert.equal(db.prepare("SELECT count(*) total FROM bookings WHERE status='CONFIRMED'").get().total, 1);
  db.close();
});

test("chaves compostas impedem referência cruzada entre tenants", () => {
  const db = database();
  db.exec("INSERT INTO tenants (id, slug, name) VALUES ('ten_other','outra','Outra'); INSERT INTO customers (id, tenant_id, name, phone) VALUES ('cus_other','ten_other','Outro','38999990000');");
  assert.throws(() => db.prepare("INSERT INTO bookings (id, tenant_id, barber_id, service_id, customer_id, start_at, end_at, status, total_cents) VALUES ('cross','ten_other','bar_rafael','srv_corte','cus_other','2026-09-10T09:00:00','2026-09-10T09:45:00','CONFIRMED',4500)").run(), /FOREIGN KEY/);
  db.close();
});

