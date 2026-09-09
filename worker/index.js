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
  const date = startAt.slice(0, 10);
  const tenantRules = await db.prepare("SELECT slot_interval_min AS slotIntervalMin FROM tenants WHERE id=?").bind(tenant.id).first();
  const [rules, blocks, existing] = await Promise.all([
    rows(db.prepare("SELECT weekday,start_time AS startTime,end_time AS endTime,active AS isActive FROM availability_rules WHERE tenant_id=? AND barber_id=?").bind(tenant.id, body.barberId)),
    rows(db.prepare("SELECT start_at AS startAt,end_at AS endAt FROM schedule_blocks WHERE tenant_id=? AND (barber_id=? OR barber_id IS NULL) AND start_at<? AND end_at>?").bind(tenant.id, body.barberId, `${date}T23:59:59`, `${date}T00:00:00`)),
    rows(db.prepare("SELECT start_at AS startAt,end_at AS endAt,status FROM bookings WHERE tenant_id=? AND barber_id=? AND start_at<? AND end_at>? AND status IN ('PENDING','CONFIRMED')").bind(tenant.id, body.barberId, `${date}T23:59:59`, `${date}T00:00:00`))
  ]);
  const allowed = buildSlots({ date, durationMin: service.durationMin, intervalMin: tenantRules.slotIntervalMin, rules, blocks, bookings: existing });
  if (!allowed.includes(startAt)) return fail(409, "SLOT_UNAVAILABLE", "Este horário não está disponível.");
  const phone = normalizePhone(body.customer.phone);
  if (phone.length < 10) return fail(400, "INVALID_PHONE", "Telefone inválido.");
  const customerId = id("cus");
  const bookingId = id("bkg");
  try {
    await db.batch([
      db.prepare("INSERT INTO customers (id, tenant_id, name, phone, email) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tenant_id, phone) DO UPDATE SET name = excluded.name, email = COALESCE(excluded.email, customers.email)").bind(customerId, tenant.id, body.customer.name.trim(), phone, body.customer.email || null),
      db.prepare("INSERT INTO bookings (id, tenant_id, barber_id, service_id, customer_id, start_at, end_at, status, total_cents, notes) VALUES (?, ?, ?, ?, (SELECT id FROM customers WHERE tenant_id = ? AND phone = ?), ?, ?, 'CONFIRMED', ?, ?)").bind(bookingId, tenant.id, body.barberId, body.serviceId, tenant.id, phone, startAt, endAt, service.priceCents, body.notes || null),
      db.prepare("INSERT INTO events (id, tenant_id, name, entity_id, properties) VALUES (?, ?, 'booking_completed', ?, ?)").bind(id("evt"), tenant.id, bookingId, JSON.stringify({ source: "web", durationSeconds: body.bookingStartedAt ? Math.max(0, Math.round((Date.now() - Number(body.bookingStartedAt)) / 1000)) : null, totalCents: service.priceCents }))
    ]);
    return json({ id: bookingId, status: "CONFIRMED", startAt, endAt }, 201);
  } catch (error) {
    if (String(error).includes("BOOKING_CONFLICT")) return fail(409, "BOOKING_CONFLICT", "Este horário acabou de ser reservado. Escolha outro.");
    throw error;
  }
}

async function trackEvent(db, request) {
  const body = await request.json().catch(() => null);
  const allowed = new Set(["visitor", "booking_started", "booking_abandoned", "booking_completed", "upsell_viewed", "whatsapp_clicked"]);
  if (!body?.tenant || !allowed.has(body.name)) return fail(400, "INVALID_EVENT", "Evento inválido.");
  const tenant = await db.prepare("SELECT id FROM tenants WHERE slug=? AND status='ACTIVE'").bind(body.tenant).first();
  if (!tenant) return fail(404, "TENANT_NOT_FOUND", "Barbearia não encontrada.");
  await db.prepare("INSERT INTO events (id,tenant_id,name,entity_id,properties) VALUES (?,?,?,?,?)").bind(id("evt"), tenant.id, body.name, body.entityId || null, JSON.stringify(body.properties || {}).slice(0, 2000)).run();
  return new Response(null, { status: 204 });
}

async function auth(db, request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return db.prepare("SELECT u.id, u.tenant_id AS tenantId, u.role, u.barber_id AS barberId FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1").bind(digest).first();
}

async function derivePassword(password, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 120000 }, material, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function login(db, request) {
  const body = await request.json().catch(() => null);
  if (!body?.tenant || !body.email || !body.password) return fail(400, "INVALID_LOGIN", "Informe barbearia, e-mail e senha.");
  const user = await db.prepare("SELECT u.id, u.password_hash AS passwordHash FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE t.slug=? AND lower(u.email)=lower(?) AND u.active=1 AND t.status='ACTIVE'").bind(body.tenant, body.email).first();
  if (!user) return fail(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
  const [salt, expected] = user.passwordHash.split(":");
  if (!salt || expected !== await derivePassword(body.password, salt)) return fail(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const tokenHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const digest = [...new Uint8Array(tokenHash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,datetime('now','+7 days'))").bind(id("ses"), user.id, digest).run();
  return json({ token, expiresIn: 604800 });
}

async function bootstrap(db, request, env) {
  if (!env.SETUP_KEY || request.headers.get("x-setup-key") !== env.SETUP_KEY) return fail(403, "SETUP_FORBIDDEN", "Chave de implantação inválida.");
  const body = await request.json().catch(() => null);
  if (!body?.tenant || !body.name || !body.owner?.email || String(body.owner.password || "").length < 10 || !/^[a-z0-9-]{3,50}$/.test(body.tenant)) return fail(400, "INVALID_SETUP", "Informe slug válido, nome, e-mail e senha com 10+ caracteres.");
  let tenant = await db.prepare("SELECT id FROM tenants WHERE slug=?").bind(body.tenant).first();
  if (tenant && await db.prepare("SELECT id FROM users WHERE tenant_id=? AND role='OWNER'").bind(tenant.id).first()) return fail(409, "OWNER_EXISTS", "Esta barbearia já possui proprietário.");
  if (!tenant) {
    tenant = { id: id("ten") };
    await db.prepare("INSERT INTO tenants (id,slug,name,logo_url,primary_color,address,whatsapp) VALUES (?,?,?,?,?,?,?)").bind(tenant.id, body.tenant, body.name.trim(), body.logoUrl || null, body.primaryColor || "#D3A84C", body.address || null, normalizePhone(body.whatsapp)).run();
  }
  const salt = crypto.randomUUID();
  const passwordHash = `${salt}:${await derivePassword(body.owner.password, salt)}`;
  await db.prepare("INSERT INTO users (id,tenant_id,email,password_hash,role) VALUES (?,?,?,?, 'OWNER')").bind(id("usr"), tenant.id, body.owner.email.trim().toLowerCase(), passwordHash).run();
  return json({ created: true }, 201);
}

const resources = {
  barbers: { roles: ["OWNER"], list: "SELECT id,name,specialties,active FROM barbers WHERE tenant_id=? ORDER BY name", insert: "INSERT INTO barbers (id,tenant_id,name,specialties) VALUES (?,?,?,?)", values: (b) => [id("bar"), b.name?.trim(), JSON.stringify(b.specialties || [])] },
  services: { roles: ["OWNER"], list: "SELECT id,name,description,duration_min AS durationMin,price_cents AS priceCents,active FROM services WHERE tenant_id=? ORDER BY name", insert: "INSERT INTO services (id,tenant_id,name,description,duration_min,price_cents) VALUES (?,?,?,?,?,?)", values: (b) => [id("srv"), b.name?.trim(), b.description || null, Number(b.durationMin), Number(b.priceCents)] },
  products: { roles: ["OWNER"], list: "SELECT id,name,description,price_cents AS priceCents,stock_qty AS stockQty,active FROM products WHERE tenant_id=? ORDER BY name", insert: "INSERT INTO products (id,tenant_id,name,description,price_cents,stock_qty) VALUES (?,?,?,?,?,?)", values: (b) => [id("prd"), b.name?.trim(), b.description || null, Number(b.priceCents), Number(b.stockQty || 0)] },
  bundles: { roles: ["OWNER"], list: "SELECT id,name,description,price_cents AS priceCents,active FROM bundles WHERE tenant_id=? ORDER BY name", insert: "INSERT INTO bundles (id,tenant_id,name,description,price_cents) VALUES (?,?,?,?,?)", values: (b) => [id("bun"), b.name?.trim(), b.description || null, Number(b.priceCents)] },
  plans: { roles: ["OWNER"], list: "SELECT id,name,billing_period AS billingPeriod,price_cents AS priceCents,validity_days AS validityDays,uses_limit AS usesLimit,priority_days AS priorityDays,active FROM plans WHERE tenant_id=? ORDER BY price_cents", insert: "INSERT INTO plans (id,tenant_id,name,billing_period,price_cents,validity_days,uses_limit,priority_days) VALUES (?,?,?,?,?,?,?,?)", values: (b) => [id("pln"), b.name?.trim(), b.billingPeriod, Number(b.priceCents), Number(b.validityDays), Number(b.usesLimit), Number(b.priorityDays || 0)] },
  customers: { roles: ["OWNER"], list: "SELECT id,name,phone,email,created_at AS createdAt FROM customers WHERE tenant_id=? ORDER BY name", insert: "INSERT INTO customers (id,tenant_id,name,phone,email) VALUES (?,?,?,?,?)", values: (b) => [id("cus"), b.name?.trim(), normalizePhone(b.phone), b.email || null] }
};

async function resourceRoute(db, request, actor, name) {
  const resource = resources[name];
  if (!resource || !resource.roles.includes(actor.role)) return fail(403, "FORBIDDEN", "Ação não permitida.");
  if (request.method === "GET") return json({ items: await rows(db.prepare(resource.list).bind(actor.tenantId)) });
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    const values = body && resource.values(body);
    if (!values || values.some((value) => value === undefined || Number.isNaN(value))) return fail(400, "INVALID_RESOURCE", "Dados inválidos.");
    const insert = db.prepare(resource.insert).bind(values[0], actor.tenantId, ...values.slice(1));
    if (name === "barbers") {
      const rules = [1,2,3,4,5,6].map((weekday) => db.prepare("INSERT INTO availability_rules (id,tenant_id,barber_id,weekday,start_time,end_time) VALUES (?,?,?,?, '09:00','20:00')").bind(id("avr"), actor.tenantId, values[0], weekday));
      await db.batch([insert, ...rules]);
    } else await insert.run();
    return json({ id: values[0] }, 201);
  }
  return fail(405, "METHOD_NOT_ALLOWED", "Método não permitido.");
}

async function adminRoute(db, request, actor, url) {
  if (url.pathname === "/api/admin/users") {
    if (actor.role !== "OWNER") return fail(403, "FORBIDDEN", "Somente o proprietário administra acessos.");
    if (request.method === "GET") return json({ items: await rows(db.prepare("SELECT id,email,role,barber_id AS barberId,active FROM users WHERE tenant_id=? ORDER BY email").bind(actor.tenantId)) });
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body?.email || !["OWNER","BARBER"].includes(body.role) || String(body.password || "").length < 10 || (body.role === "BARBER" && !body.barberId)) return fail(400, "INVALID_USER", "Informe e-mail, papel, profissional e senha com 10+ caracteres.");
      if (body.role === "BARBER" && !await db.prepare("SELECT id FROM barbers WHERE id=? AND tenant_id=?").bind(body.barberId, actor.tenantId).first()) return fail(400, "INVALID_BARBER", "Profissional inválido.");
      const salt = crypto.randomUUID();
      const passwordHash = `${salt}:${await derivePassword(body.password, salt)}`;
      const userId = id("usr");
      await db.prepare("INSERT INTO users (id,tenant_id,barber_id,email,password_hash,role) VALUES (?,?,?,?,?,?)").bind(userId, actor.tenantId, body.role === "BARBER" ? body.barberId : null, body.email.trim().toLowerCase(), passwordHash, body.role).run();
      return json({ id: userId }, 201);
    }
    return fail(405, "METHOD_NOT_ALLOWED", "Método não permitido.");
  }
  if (request.method === "GET" && url.pathname === "/api/admin/summary") {
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const barberClause = actor.role === "BARBER" ? " AND barber_id=?" : "";
    const params = [actor.tenantId, `${date}T00:00:00`, `${date}T23:59:59`, ...(actor.role === "BARBER" ? [actor.barberId] : [])];
    const summary = await db.prepare(`SELECT count(*) appointments,coalesce(sum(CASE WHEN status IN ('CONFIRMED','COMPLETED') THEN total_cents ELSE 0 END),0) revenueCents,sum(CASE WHEN status='CONFIRMED' THEN 1 ELSE 0 END) confirmed,sum(CASE WHEN status='NO_SHOW' THEN 1 ELSE 0 END) noShows FROM bookings WHERE tenant_id=? AND start_at>=? AND start_at<?${barberClause}`).bind(...params).first();
    return json(summary);
  }
  if (request.method === "GET" && url.pathname === "/api/admin/today") {
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const barberFilter = actor.role === "BARBER" ? " AND b.barber_id = ?" : "";
    const query = `SELECT b.id,b.start_at AS startAt,b.end_at AS endAt,b.status,c.name AS customerName,c.phone,s.name AS serviceName,br.name AS barberName,b.total_cents AS totalCents FROM bookings b JOIN customers c ON c.id=b.customer_id AND c.tenant_id=b.tenant_id JOIN services s ON s.id=b.service_id AND s.tenant_id=b.tenant_id JOIN barbers br ON br.id=b.barber_id AND br.tenant_id=b.tenant_id WHERE b.tenant_id=? AND b.start_at>=? AND b.start_at<?${barberFilter} ORDER BY b.start_at`;
    const params = [actor.tenantId, `${date}T00:00:00`, `${date}T23:59:59`, ...(actor.role === "BARBER" ? [actor.barberId] : [])];
    return json({ bookings: await rows(db.prepare(query).bind(...params)) });
  }
  const bookingMatch = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)$/);
  if (bookingMatch && request.method === "PATCH") {
    const body = await request.json().catch(() => null);
    const barberGuard = actor.role === "BARBER" ? " AND barber_id=?" : "";
    if (body?.startAt) {
      const current = await db.prepare(`SELECT b.id,s.duration_min AS durationMin FROM bookings b JOIN services s ON s.id=b.service_id AND s.tenant_id=b.tenant_id WHERE b.id=? AND b.tenant_id=?${barberGuard}`).bind(bookingMatch[1], actor.tenantId, ...(actor.role === "BARBER" ? [actor.barberId] : [])).first();
      if (!current) return fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.");
      const start = new Date(body.startAt);
      if (Number.isNaN(start.valueOf())) return fail(400, "INVALID_DATE", "Horário inválido.");
      const startAt = start.toISOString().slice(0, 19);
      const endAt = new Date(start.valueOf() + current.durationMin * 60000).toISOString().slice(0, 19);
      try { await db.prepare("UPDATE bookings SET start_at=?,end_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?").bind(startAt, endAt, bookingMatch[1], actor.tenantId).run(); }
      catch (error) { if (String(error).includes("BOOKING_CONFLICT")) return fail(409, "BOOKING_CONFLICT", "Novo horário indisponível."); throw error; }
      return json({ updated: true, startAt, endAt });
    }
    if (!body || !["CONFIRMED","COMPLETED","CANCELLED","NO_SHOW"].includes(body.status)) return fail(400, "INVALID_STATUS", "Status inválido.");
    const result = await db.prepare(`UPDATE bookings SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?${barberGuard}`).bind(body.status, bookingMatch[1], actor.tenantId, ...(actor.role === "BARBER" ? [actor.barberId] : [])).run();
    return result.meta?.changes ? json({ updated: true }) : fail(404, "BOOKING_NOT_FOUND", "Reserva não encontrada.");
  }
  if (url.pathname === "/api/admin/blocks" && request.method === "POST") {
    if (actor.role !== "OWNER") return fail(403, "FORBIDDEN", "Somente o proprietário pode bloquear horários.");
    const body = await request.json().catch(() => null);
    if (!body?.startAt || !body?.endAt || body.startAt >= body.endAt) return fail(400, "INVALID_BLOCK", "Período inválido.");
    const blockId = id("blk");
    await db.prepare("INSERT INTO schedule_blocks (id,tenant_id,barber_id,start_at,end_at,reason) VALUES (?,?,?,?,?,?)").bind(blockId, actor.tenantId, body.barberId || null, body.startAt, body.endAt, body.reason || null).run();
    return json({ id: blockId }, 201);
  }
  const resourceMatch = url.pathname.match(/^\/api\/admin\/(barbers|services|products|bundles|plans|customers)$/);
  if (resourceMatch) return resourceRoute(db, request, actor, resourceMatch[1]);
  return fail(403, "FORBIDDEN", "Ação não permitida.");
}

async function api(request, env) {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/api/auth/login") return login(env.DB, request);
  if (request.method === "POST" && url.pathname === "/api/setup/bootstrap") return bootstrap(env.DB, request, env);
  if (request.method === "GET" && url.pathname.startsWith("/api/public/catalog/")) {
    const catalog = await publicCatalog(env.DB, decodeURIComponent(url.pathname.split("/").pop()));
    return catalog ? json(catalog) : fail(404, "TENANT_NOT_FOUND", "Barbearia não encontrada.");
  }
  if (request.method === "GET" && url.pathname === "/api/public/availability") return availability(env.DB, url);
  if (request.method === "POST" && url.pathname === "/api/public/bookings") return createBooking(env.DB, request);
  if (request.method === "POST" && url.pathname === "/api/public/events") return trackEvent(env.DB, request);
  if (url.pathname.startsWith("/api/admin/")) {
    const actor = await auth(env.DB, request);
    if (!actor) return fail(401, "UNAUTHORIZED", "Autenticação necessária.");
    return adminRoute(env.DB, request, actor, url);
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
