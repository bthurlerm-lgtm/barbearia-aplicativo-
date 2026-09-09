import test from "node:test";
import assert from "node:assert/strict";
import { buildSlots, hasBookingConflict, overlaps, requireTenantMatch } from "../worker/domain.js";

test("intervalos adjacentes não conflitam", () => {
  assert.equal(overlaps("2026-09-10T09:00:00", "2026-09-10T09:45:00", "2026-09-10T09:45:00", "2026-09-10T10:30:00"), false);
});

test("detecta conflito somente no mesmo tenant e barbeiro", () => {
  const existing = [{ tenantId: "t1", barberId: "b1", startAt: "2026-09-10T09:00:00", endAt: "2026-09-10T09:45:00", status: "CONFIRMED" }];
  assert.equal(hasBookingConflict({ tenantId: "t1", barberId: "b1", startAt: "2026-09-10T09:30:00", endAt: "2026-09-10T10:00:00" }, existing), true);
  assert.equal(hasBookingConflict({ tenantId: "t2", barberId: "b1", startAt: "2026-09-10T09:30:00", endAt: "2026-09-10T10:00:00" }, existing), false);
});

test("motor remove reservas e bloqueios", () => {
  const slots = buildSlots({
    date: "2026-09-10",
    durationMin: 45,
    intervalMin: 15,
    rules: [{ weekday: 4, startTime: "09:00", endTime: "11:00", isActive: 1 }],
    bookings: [{ startAt: "2026-09-10T09:45:00", endAt: "2026-09-10T10:30:00", status: "CONFIRMED" }],
    blocks: [{ startAt: "2026-09-10T10:30:00", endAt: "2026-09-10T11:00:00" }]
  });
  assert.deepEqual(slots, ["2026-09-10T09:00:00"]);
});

test("isolamento de tenant exige correspondência", () => {
  assert.equal(requireTenantMatch({ tenantId: "t1" }, "t1"), true);
  assert.equal(requireTenantMatch({ tenantId: "t1" }, "t2"), false);
});

