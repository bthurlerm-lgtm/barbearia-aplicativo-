const state = { config: null, step: 0, service: null, barber: null, date: new Date().toISOString().slice(0, 10), time: null, loading: false, error: null, bookingStartedAt: null };

async function boot() {
  try {
    const catalog = await fetch("/api/public/catalog/demo-barbearia");
    state.config = catalog.ok ? await catalog.json() : await fetch("./config/barbershop.json").then((r) => r.json());
    if (state.config.tenant) state.config = { ...state.config.tenant, services: state.config.services, barbers: state.config.barbers, products: state.config.products, bundles: state.config.bundles, plans: state.config.plans };
  } catch {
    state.config = await fetch("./config/barbershop.json").then((r) => r.json());
  }
  applyTheme();
  render();
  track("visitor");
}

function track(name, properties = {}) {
  const tenant = state.config?.slug || state.config?.id;
  if (!tenant) return;
  fetch("/api/public/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenant, name, properties }), keepalive: true }).catch(() => {});
}

function applyTheme() {
  const theme = state.config.theme || { background: "#0C0D0F", surface: "#16181C", text: "#F7F7F5", muted: "#A4A7AE", accent: state.config.primaryColor || "#D3A84C" };
  for (const [key, value] of Object.entries({ "--bg": theme.background, "--surface": theme.surface, "--text": theme.text, "--muted": theme.muted, "--accent": theme.accent })) document.documentElement.style.setProperty(key, value);
}

function priceCents(item) { return item.priceCents ?? Math.round(item.price * 100); }
function duration(item) { return item.durationMin; }
function money(cents) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
function e(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }

async function loadSlots() {
  state.loading = true;
  state.error = null;
  render();
  try {
    const query = new URLSearchParams({ tenant: state.config.slug || state.config.id, barberId: state.barber.id, serviceId: state.service.id, date: state.date });
    const response = await fetch(`/api/public/availability?${query}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Não foi possível carregar os horários.");
    state.slots = result.slots;
  } catch (error) {
    state.error = error.message;
    state.slots = [];
  } finally {
    state.loading = false;
    render();
  }
}

async function confirmBooking() {
  const form = document.querySelector("#customer-form");
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  state.loading = true;
  state.error = null;
  render();
  try {
    const response = await fetch("/api/public/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenant: state.config.slug || state.config.id, serviceId: state.service.id, barberId: state.barber.id, startAt: state.time, bookingStartedAt: state.bookingStartedAt, customer: { name: data.get("name"), phone: data.get("phone") } }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Não foi possível confirmar.");
    state.booking = result;
    state.step = 4;
  } catch (error) {
    state.error = error.message;
    state.loading = false;
  }
  render();
}

function render() {
  const app = document.querySelector("#app");
  if (state.step === 4) {
    app.innerHTML = `<div class="shell success"><div class="success-mark">✓</div><h1>Agendamento confirmado</h1><p class="meta">${e(state.service.name)} com ${e(state.barber.name)}<br>${formatDateTime(state.time)}</p><button class="ghost" id="again">Novo agendamento</button></div>`;
    document.querySelector("#again").onclick = () => { Object.assign(state, { step: 0, service: null, barber: null, time: null, booking: null, error: null }); render(); };
    return;
  }
  const pages = [servicesPage, barbersPage, timesPage, confirmPage];
  app.innerHTML = `<div class="shell"><header class="brand"><strong>${e(state.config.name)}</strong><span class="badge">AGENDA ONLINE</span></header>${state.error ? `<div class="alert">${e(state.error)}</div>` : ""}${pages[state.step]()}</div><div class="bottom"><div class="bottom-inner"><div class="step">Etapa ${state.step + 1} de 4</div>${state.step > 0 ? `<div class="summary">${summary()}</div>` : ""}<button class="cta" id="next" ${canNext() && !state.loading ? "" : "disabled"}>${state.loading ? "Carregando…" : state.step === 3 ? "Confirmar agendamento" : "Continuar"}</button></div></div>`;
  bind();
}

function servicesPage() { return `<section class="hero"><h1>Seu próximo corte começa aqui.</h1><p>Escolha o serviço e encontre um horário realmente disponível.</p></section><section class="section"><h2>Serviços</h2><div class="grid">${state.config.services.map((service) => `<button class="card service" data-id="${e(service.id)}" data-selected="${state.service?.id === service.id}"><div class="row"><div><strong>${e(service.name)}</strong><div class="meta">${duration(service)} min</div></div><span class="price">${money(priceCents(service))}</span></div></button>`).join("")}</div></section>`; }
function barbersPage() { return `<section class="hero"><h1>Escolha seu barbeiro.</h1><p>Veja especialidades antes de reservar.</p></section><section class="section"><div class="grid">${state.config.barbers.map((barber) => `<button class="card barber" data-id="${e(barber.id)}" data-selected="${state.barber?.id === barber.id}"><div class="row"><div><strong>${e(barber.name)}</strong><div>${(barber.specialties || []).map((x) => `<span class="pill">${e(x)}</span>`).join("")}</div></div><span>›</span></div></button>`).join("")}</div></section>`; }
function timesPage() { return `<section class="hero"><h1>Escolha o horário.</h1><p>Mostramos apenas horários compatíveis com a agenda.</p></section><label class="date-label">Data<input id="date" type="date" min="${new Date().toISOString().slice(0, 10)}" value="${state.date}"></label><section class="section">${state.loading ? `<p class="meta">Consultando agenda…</p>` : state.slots?.length ? `<div class="times">${state.slots.map((slot) => `<button class="time ${state.time === slot ? "selected" : ""}" data-time="${slot}">${slot.slice(11, 16)}</button>`).join("")}</div>` : `<p class="empty">Nenhum horário disponível nesta data.</p>`}</section>`; }
function confirmPage() { return `<section class="hero"><h1>Confirme em segundos.</h1><p>Seus dados ficam vinculados somente a esta barbearia.</p></section><section class="section"><div class="card details"><div class="row"><span class="meta">Serviço</span><strong>${e(state.service.name)}</strong></div><div class="row"><span class="meta">Barbeiro</span><strong>${e(state.barber.name)}</strong></div><div class="row"><span class="meta">Horário</span><strong>${formatDateTime(state.time)}</strong></div><div class="row"><span class="meta">Valor</span><strong class="price">${money(priceCents(state.service))}</strong></div></div><form id="customer-form" class="form"><label>Nome<input name="name" autocomplete="name" required maxlength="80"></label><label>WhatsApp<input name="phone" inputmode="tel" autocomplete="tel" required minlength="10" maxlength="20"></label></form></section>`; }

function formatDateTime(value) { const [date, time] = value.split("T"); const [year, month, day] = date.split("-"); return `${day}/${month}/${year} às ${time.slice(0, 5)}`; }
function summary() { return [state.service && `<strong>${e(state.service.name)}</strong>`, state.barber && e(state.barber.name), state.time && state.time.slice(11, 16)].filter(Boolean).join(" • "); }
function canNext() { return [!!state.service, !!state.barber, !!state.time, true][state.step]; }

function bind() {
  document.querySelectorAll(".service").forEach((element) => element.onclick = () => { state.service = state.config.services.find((x) => x.id === element.dataset.id); if (!state.bookingStartedAt) { state.bookingStartedAt = Date.now(); track("booking_started"); } render(); });
  document.querySelectorAll(".barber").forEach((element) => element.onclick = () => { state.barber = state.config.barbers.find((x) => x.id === element.dataset.id); render(); });
  document.querySelectorAll(".time").forEach((element) => element.onclick = () => { state.time = element.dataset.time; render(); });
  const date = document.querySelector("#date");
  if (date) date.onchange = () => { state.date = date.value; state.time = null; loadSlots(); };
  document.querySelector("#next").onclick = () => {
    if (!canNext()) return;
    if (state.step === 1) { state.step = 2; loadSlots(); return; }
    if (state.step === 3) { confirmBooking(); return; }
    state.step += 1;
    render();
  };
}

boot();
