const ACTIVE_BOOKING_STATUSES = new Set(["PENDING", "CONFIRMED"]);

export function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

export function hasBookingConflict(candidate, bookings) {
  return bookings.some((booking) =>
    booking.tenantId === candidate.tenantId &&
    booking.barberId === candidate.barberId &&
    ACTIVE_BOOKING_STATUSES.has(booking.status) &&
    overlaps(candidate.startAt, candidate.endAt, booking.startAt, booking.endAt)
  );
}

export function buildSlots({ date, durationMin, intervalMin = 15, rules, blocks = [], bookings = [] }) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const iso = (value) => `${date}T${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}:00`;
  const busy = [...blocks, ...bookings.filter((b) => ACTIVE_BOOKING_STATUSES.has(b.status))];
  const slots = [];

  for (const rule of rules.filter((r) => Number(r.weekday) === day && r.isActive !== false)) {
    for (let cursor = minutes(rule.startTime); cursor + durationMin <= minutes(rule.endTime); cursor += intervalMin) {
      const startAt = iso(cursor);
      const endAt = iso(cursor + durationMin);
      if (!busy.some((item) => overlaps(startAt, endAt, item.startAt, item.endAt))) slots.push(startAt);
    }
  }
  return slots;
}

export function requireTenantMatch(actor, tenantId) {
  return Boolean(actor?.tenantId && actor.tenantId === tenantId);
}

