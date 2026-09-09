import { buildSlots } from "./domain.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const normalizePhone = (value = "") => value.replace(/\D/g, "").slice(0, 15);

function fail(status, code, message) {
  return json({ error: { code, message } }, status);
}

async function rows(statement) {
  const result = await statement.all();
  return result.results ?? [];
}

async function publicCatalog(db, slug) {
  const tenant = await db.prepare("SELECT id, slug, name, logo_url AS logoUrl, primary_color AS primaryColor, address, whatsapp FROM tenants WHERE slug = ? AND status = 'ACTIVE'").bind(slug).first();
  if (!tenant) return null;
  const [services, barbers, products, bundles, plans] = await Promise.all([
    rows(db.prepare("SELECT id, name, description, duration_min AS durationMin, price_cents AS priceCents FROM services WHERE tenant_id = ? AND active = 1 ORDER BY name").bind(tenant.id)),
    rows(db.prepare("SELECT id, name, specialties FROM barbers WHERE tenant_id = ? AND active = 1 ORDER BY name").bind(tenant.id)),
    rows(db.prepare("SELECT id, name, description, price_cents AS priceCents, stock_qty AS stockQty FROM products WHERE tenant_id = ? AND active = 1 ORDER BY name").bind(tenant.id)),
    rows(db.prepare("SELECT id, name, description, price_cents AS priceCents FROM bundles WHERE tenant_id = ? AND active = 1 ORDER BY name").bind(tenant.id)),
    rows(db.prepare("SELECT id, name, billing_period AS billingPeriod, price_cents AS priceCents, validity_days AS validityDays, uses_limit AS usesLimit, priority_days AS priorityDays FROM plans WHERE tenant_id = ? AND active = 1 ORDER BY price_cents").bind(tenant.id))
  ]);
  return { tenant, services, barbers: barbers.map((b) => ({ ...b, specialties: JSON.parse(b.specialties || "[]") })), products, bundles, plans };
}

async function availability(db, url) {
  const slug = url.searchParams.get("tenant");
  const barberId = url.searchParams.get("barberId");
  const serviceId = url.searchParams.get("serviceId");
  const date = url.searchParams.get("date");
  if (!slug || !barberId || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return fail(400, "INVALID_QUERY", "Informe tenant, barbeiro, serviço e data.");
  const tenant = await db.prepare("SELECT id, slot_interval_min AS slotIntervalMin FROM tenants WHERE slug = ? AND status = 'ACTIVE'").bind(slug).first();
  if (!tenant) return fail(404, "TENANT_NOT_FOUND", "Barbearia não encontrada.");
  const service = await db.prepare("SELECT duration_min AS durationMin FROM services WHERE id = ? AND tenant_id = ? AND active = 1").bind(serviceId, tenant.id).first();
  const barber = await db.prepare("SELECT id FROM barbers WHERE id = ? AND tenant_id = ? AND active = 1").bind(barberId, tenant.id).first();
  if (!service || !barber) return fail(404, "RESOURCE_NOT_FOUND", "Serviço ou profissional indisponível.");
  const rangeStart = `${date}T00:00:00`;
  const rangeEnd = `${date}T23:59:59`;
  const [rules, blocks, bookings] = await Promise.all([
    rows(db.prepare("SELECT weekday, start_time AS startTime, end_time AS endTime, active AS isActive FROM availability_rules WHERE tenant_id = ? AND barber_id = ?").bind(tenant.id, barberId)),
    rows(db.prepare("SELECT start_at AS startAt, end_at AS endAt FROM schedule_blocks WHERE tenant_id = ? AND (barber_id = ? OR barber_id IS NULL) AND start_at < ? AND end_at > ?").bind(tenant.id, barberId, rangeEnd, rangeStart)),
    rows(db.prepare("SELECT start_at AS startAt, end_at AS endAt, status FROM bookings WHERE tenant_id = ? AND barber_id = ? AND start_at < ? AND end_at > ? AND status IN ('PENDING','CONFIRMED')").bind(tenant.id, barberId, rangeEnd, rangeStart))
  ]);
  return json({ slots: buildSlots({ date, durationMin: service.durationMin, intervalMin: tenant.slotIntervalMin, rules, blocks, bookings }) });
}

async function createBooking(db, request) {
  const body = await request.json().catch(() => null);
  if (!body?.tenant || !body.barberId || !body.serviceId || !body.startAt || !body.customer?.name || !body.customer?.phone) return fail(400, "INVALID_BOOKING", "Preencha cliente, serviço, profissional e horário.");
  const tenant = await db.prepare("SELECT id FROM tenants WHERE slug = ? AND status = 'ACTIVE'").bind(body.tenant).first();
  if (!tenant) return fail(404, "TENANT_NOT_FOUND", "Barbearia não encontrada.");
  const service = await db.prepare("SELECT duration_min AS durationMin, price_cents AS priceCents FROM services WHERE id = ? AND tenant_id = ? AND active = 1").bind(body.serviceId, tenant.id).first();
  const barber = await db.prepare("SELECT id FROM barbers WHERE id = ? AND tenant_id = ? AND active = 1").bind(body.barberId, tenant.id).first();
  if (!service || !barber) return fail(404, "RESOURCE_NOT_FOUND", "Serviço ou profissional indisponível.");
  const start = new Date(body.startAt);
  if (Number.isNaN(start.valueOf())) return fail(400, "INVALID_DATE", "Horário inválido.");
  const endAt = new Date(start.valueOf() + service.durationMin * 60000).toISOString().slice(0, 19);
  const startAt = start.toISOString().slice(0, 19);
  const phone = normalizePhone(body.customer.phone);
  if (phone.length < 10) return fail(400, "INVALID_PHONE", "Telefone inválido.");
  const customerId = id("cus");
  const bookingId = id("bkg");
  try {
    await db.batch([
      db.prepare("INSERT INTO customers (id, tenant_id, name, phone, email) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tenant_id, phone) DO UPDATE SET name = excluded.name, email = COALESCE(excluded.email, customers.email)").bind(customerId, tenant.id, body.customer.name.trim(), phone, body.customer.email || null),
      db.prepare("INSERT INTO bookings (id, tenant_id, barber_id, service_id, customer_id, start_at, end_at, status, total_cents, notes) VALUES (?, ?, ?, ?, (SELECT id FROM customers WHERE tenant_id = ? AND phone = ?), ?, ?, 'CONFIRMED', ?, ?)").bind(bookingId, tenant.id, body.barberId, body.serviceId, tenant.id, phone, startAt, endAt, service.priceCents, body.notes || null),
      db.prepare("INSERT INTO events (id, tenant_id, name, entity_id, properties) VALUES (?, ?, 'booking_completed', ?, ?)").bind(id("evt"), tenant.id, bookingId, JSON.stringify({ source: "web" }))
    ]);
    return json({ id: bookingId, status: "CONFIRMED", startAt, endAt }, 201);
  } catch (error) {
    if (String(error).includes("BOOKING_CONFLICT")) return fail(409, "BOOKING_CONFLICT", "Este horário acabou de ser reservado. Escolha outro.");
    throw error;
  }
}

async function auth(db, request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return db.prepare("SELECT u.id, u.tenant_id AS tenantId, u.role, u.barber_id AS barberId FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1").bind(digest).first();
}

async function api(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname.startsWith("/api/public/catalog/")) {
    const catalog = await publicCatalog(env.DB, decodeURIComponent(url.pathname.split("/").pop()));
    return catalog ? json(catalog) : fail(404, "TENANT_NOT_FOUND", "Barbearia não encontrada.");
  }
  if (request.method === "GET" && url.pathname === "/api/public/availability") return availability(env.DB, url);
  if (request.method === "POST" && url.pathname === "/api/public/bookings") return createBooking(env.DB, request);
  if (url.pathname.startsWith("/api/admin/")) {
    const actor = await auth(env.DB, request);
    if (!actor) return fail(401, "UNAUTHORIZED", "Autenticação necessária.");
    if (request.method === "GET" && url.pathname === "/api/admin/today") {
      const date = url.searchParams.get("date");
      const barberFilter = actor.role === "BARBER" ? " AND b.barber_id = ?" : "";
      const query = `SELECT b.id, b.start_at AS startAt, b.end_at AS endAt, b.status, c.name AS customerName, c.phone, s.name AS serviceName, br.name AS barberName, b.total_cents AS totalCents FROM bookings b JOIN customers c ON c.id=b.customer_id AND c.tenant_id=b.tenant_id JOIN services s ON s.id=b.service_id AND s.tenant_id=b.tenant_id JOIN barbers br ON br.id=b.barber_id AND br.tenant_id=b.tenant_id WHERE b.tenant_id=? AND b.start_at>=? AND b.start_at<?${barberFilter} ORDER BY b.start_at`;
      const params = [actor.tenantId, `${date}T00:00:00`, `${date}T23:59:59`, ...(actor.role === "BARBER" ? [actor.barberId] : [])];
      return json({ bookings: await rows(env.DB.prepare(query).bind(...params)) });
    }
    return fail(403, "FORBIDDEN", "Ação não permitida.");
  }
  return fail(404, "NOT_FOUND", "Rota não encontrada.");
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await api(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return fail(500, "INTERNAL_ERROR", "Não foi possível concluir agora.");
    }
  }
};

