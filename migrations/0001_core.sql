PRAGMA foreign_keys = ON;

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#D3A84C',
  address TEXT,
  whatsapp TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  slot_interval_min INTEGER NOT NULL DEFAULT 15 CHECK(slot_interval_min BETWEEN 5 AND 60),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE barbers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialties TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(tenant_id, id)
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id TEXT,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('OWNER','BARBER','CUSTOMER')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email),
  FOREIGN KEY(tenant_id, barber_id) REFERENCES barbers(tenant_id, id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, phone),
  UNIQUE(tenant_id, id)
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER NOT NULL CHECK(duration_min BETWEEN 5 AND 480),
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(tenant_id, id)
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK(stock_qty >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(tenant_id, id)
);

CREATE TABLE bundles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(tenant_id, id)
);

CREATE TABLE bundle_items (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bundle_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('SERVICE','PRODUCT')),
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  PRIMARY KEY(tenant_id, bundle_id, item_type, item_id),
  FOREIGN KEY(tenant_id, bundle_id) REFERENCES bundles(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  billing_period TEXT NOT NULL CHECK(billing_period IN ('MONTHLY','QUARTERLY')),
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  validity_days INTEGER NOT NULL CHECK(validity_days > 0),
  uses_limit INTEGER NOT NULL CHECK(uses_limit > 0),
  priority_days INTEGER NOT NULL DEFAULT 0 CHECK(priority_days BETWEEN 0 AND 90),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(tenant_id, id)
);

CREATE TABLE plan_services (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  PRIMARY KEY(tenant_id, plan_id, service_id),
  FOREIGN KEY(tenant_id, plan_id) REFERENCES plans(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id, service_id) REFERENCES services(tenant_id, id)
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  uses_remaining INTEGER NOT NULL CHECK(uses_remaining >= 0),
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','PAUSED','CANCELLED','EXPIRED')),
  FOREIGN KEY(tenant_id, customer_id) REFERENCES customers(tenant_id, id),
  FOREIGN KEY(tenant_id, plan_id) REFERENCES plans(tenant_id, id),
  UNIQUE(tenant_id, id)
);

CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  uses_remaining INTEGER NOT NULL CHECK(uses_remaining >= 0),
  expires_at TEXT NOT NULL,
  FOREIGN KEY(tenant_id, subscription_id) REFERENCES subscriptions(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id, service_id) REFERENCES services(tenant_id, id),
  UNIQUE(tenant_id, id)
);

CREATE TABLE availability_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  FOREIGN KEY(tenant_id, barber_id) REFERENCES barbers(tenant_id, id) ON DELETE CASCADE,
  CHECK(start_time < end_time),
  UNIQUE(tenant_id, barber_id, weekday, start_time)
);

CREATE TABLE schedule_blocks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  reason TEXT,
  FOREIGN KEY(tenant_id, barber_id) REFERENCES barbers(tenant_id, id) ON DELETE CASCADE,
  CHECK(start_at < end_at)
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id, barber_id) REFERENCES barbers(tenant_id, id),
  FOREIGN KEY(tenant_id, service_id) REFERENCES services(tenant_id, id),
  FOREIGN KEY(tenant_id, customer_id) REFERENCES customers(tenant_id, id),
  CHECK(start_at < end_at),
  UNIQUE(tenant_id, id)
);

CREATE TRIGGER bookings_no_overlap_insert
BEFORE INSERT ON bookings
WHEN NEW.status IN ('PENDING','CONFIRMED')
BEGIN
  SELECT RAISE(ABORT, 'BOOKING_CONFLICT')
  WHERE EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.tenant_id = NEW.tenant_id
      AND b.barber_id = NEW.barber_id
      AND b.status IN ('PENDING','CONFIRMED')
      AND NEW.start_at < b.end_at
      AND NEW.end_at > b.start_at
  );
END;

CREATE TRIGGER bookings_no_overlap_update
BEFORE UPDATE OF tenant_id, barber_id, start_at, end_at, status ON bookings
WHEN NEW.status IN ('PENDING','CONFIRMED')
BEGIN
  SELECT RAISE(ABORT, 'BOOKING_CONFLICT')
  WHERE EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id <> OLD.id
      AND b.tenant_id = NEW.tenant_id
      AND b.barber_id = NEW.barber_id
      AND b.status IN ('PENDING','CONFIRMED')
      AND NEW.start_at < b.end_at
      AND NEW.end_at > b.start_at
  );
END;

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT,
  booking_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('OPEN','PAID','CANCELLED','REFUNDED')),
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id, customer_id) REFERENCES customers(tenant_id, id),
  FOREIGN KEY(tenant_id, booking_id) REFERENCES bookings(tenant_id, id),
  UNIQUE(tenant_id, id)
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('SERVICE','PRODUCT','BUNDLE','PLAN')),
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents >= 0),
  FOREIGN KEY(tenant_id, order_id) REFERENCES orders(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_id TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_availability ON bookings(tenant_id, barber_id, start_at, end_at, status);
CREATE INDEX idx_blocks_availability ON schedule_blocks(tenant_id, barber_id, start_at, end_at);
CREATE INDEX idx_events_tenant_name ON events(tenant_id, name, occurred_at);

