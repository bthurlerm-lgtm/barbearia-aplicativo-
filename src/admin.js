const state = { token: sessionStorage.getItem("barbearia_token"), date: new Date().toISOString().slice(0, 10), bookings: [], summary: null, error: null, loading: false };
const root = document.querySelector("#admin");

const money = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const api = async (path, options = {}) => {
  const response = await fetch(path, { ...options, headers: { "content-type": "application/json", authorization: `Bearer ${state.token}`, ...options.headers } });
  const result = await response.json();
  if (response.status === 401) { sessionStorage.removeItem("barbearia_token"); state.token = null; render(); throw new Error("Sessão encerrada."); }
  if (!response.ok) throw new Error(result.error?.message || "Não foi possível concluir.");
  return result;
};

function loginPage() {
  root.innerHTML = `<div class="shell admin-login"><header class="brand"><strong>Barbearia App</strong><span class="badge">PAINEL</span></header><section class="hero"><h1>Sua operação, sem ruído.</h1><p>Entre para administrar agenda, clientes e receita.</p></section>${state.error ? `<div class="alert">${state.error}</div>` : ""}<form id="login" class="form"><label>Identificador da barbearia<input name="tenant" value="demo-barbearia" required></label><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><button class="cta" type="submit">Entrar</button></form></div>`;
  document.querySelector("#login").onsubmit = login;
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.error = null;
  try {
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Credenciais inválidas.");
    state.token = result.token;
    sessionStorage.setItem("barbearia_token", result.token);
    await load();
  } catch (error) { state.error = error.message; loginPage(); }
}

async function load() {
  state.loading = true;
  render();
  try {
    [state.summary, { bookings: state.bookings }] = await Promise.all([api(`/api/admin/summary?date=${state.date}`), api(`/api/admin/today?date=${state.date}`)]);
    state.error = null;
  } catch (error) { state.error = error.message; }
  state.loading = false;
  render();
}

function render() {
  if (!state.token) return loginPage();
  root.innerHTML = `<div class="shell admin-shell"><header class="brand"><div><span class="eyebrow">PAINEL</span><strong>Agenda de hoje</strong></div><button class="link" id="logout">Sair</button></header>${state.error ? `<div class="alert">${state.error}</div>` : ""}<label class="date-label">Data<input id="admin-date" type="date" value="${state.date}"></label>${state.loading || !state.summary ? `<p class="empty">Atualizando operação…</p>` : dashboard()}</div>`;
  document.querySelector("#logout").onclick = () => { sessionStorage.removeItem("barbearia_token"); state.token = null; render(); };
  document.querySelector("#admin-date").onchange = (event) => { state.date = event.target.value; load(); };
  document.querySelectorAll("[data-status]").forEach((button) => button.onclick = () => updateStatus(button.dataset.id, button.dataset.status));
  document.querySelectorAll("[data-reschedule]").forEach((button) => button.onclick = () => reschedule(button.dataset.id));
  const block = document.querySelector("#block-time");
  if (block) block.onclick = blockTime;
}

function dashboard() {
  return `<section class="metrics"><article><span>Atendimentos</span><strong>${state.summary.appointments}</strong></article><article><span>Receita prevista</span><strong>${money(state.summary.revenueCents)}</strong></article><article><span>Confirmados</span><strong>${state.summary.confirmed || 0}</strong></article></section><button class="ghost" id="block-time">Bloquear horário</button><section class="section"><div class="section-head"><h2>Próximos clientes</h2><span class="meta">${state.bookings.length} na agenda</span></div><div class="agenda">${state.bookings.length ? state.bookings.map(bookingCard).join("") : `<p class="empty">Agenda livre neste dia.</p>`}</div></section><nav class="admin-nav"><a class="active" href="./admin.html">Agenda</a><a href="./index.html">Nova reserva</a><a href="./manage.html">Gestão</a></nav>`;
}

function bookingCard(booking) {
  return `<article class="appointment"><time>${booking.startAt.slice(11, 16)}</time><div class="appointment-main"><strong>${booking.customerName}</strong><span>${booking.serviceName} • ${booking.barberName}</span><small>${booking.status}</small></div><div class="appointment-actions">${booking.status === "CONFIRMED" ? `<button data-id="${booking.id}" data-status="COMPLETED">Concluir</button><button data-id="${booking.id}" data-status="CANCELLED" class="danger-link">Cancelar</button><button data-id="${booking.id}" data-reschedule="true">Remarcar</button>` : ""}</div></article>`;
}

async function updateStatus(id, status) {
  try { await api(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
  catch (error) { state.error = error.message; render(); }
}

async function reschedule(id) {
  const startAt = prompt("Novo horário (AAAA-MM-DDTHH:MM)");
  if (!startAt) return;
  try { await api(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ startAt }) }); await load(); }
  catch (error) { state.error = error.message; render(); }
}

async function blockTime() {
  const startAt = prompt("Início do bloqueio (AAAA-MM-DDTHH:MM)", `${state.date}T12:00`);
  if (!startAt) return;
  const endAt = prompt("Fim do bloqueio (AAAA-MM-DDTHH:MM)", `${state.date}T13:00`);
  if (!endAt) return;
  try { await api("/api/admin/blocks", { method: "POST", body: JSON.stringify({ startAt, endAt, reason: "Bloqueio manual" }) }); await load(); }
  catch (error) { state.error = error.message; render(); }
}

state.token ? load() : render();
