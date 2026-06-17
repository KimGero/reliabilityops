// src/tests/utils.test.ts
/// <reference types="vitest" />

import { describe, it, expect } from 'vitest'
import {
  errorBudgetMinutes,
  consumedBudgetMinutes,
  errorBudgetRemainingPct,
  calculateMTTR,
  calculateMTBF
} from '../lib/utils.js'
import type { Incident } from '../types/index.js'

// ─── Helper ─────────────────────────────────────────────────────
const makeInc = (startMsAgo: number, durationMs: number | null): Incident => ({
  id: crypto.randomUUID(),
  endpoint_id: 'ep1',
  status: 'Resolved',
  organization_id: null,
  acknowledged_by: null,
  acknowledged_at: null,
  started_at: new Date(Date.now() - startMsAgo).toISOString(),
  resolved_at: durationMs !== null
    ? new Date(Date.now() - startMsAgo + durationMs).toISOString()
    : null,
})

// ─── errorBudgetMinutes ────────────────────────────────────────
describe('errorBudgetMinutes', () => {
  it('99.9% SLO over 30 days ≈ 43.2 min', () => {
    expect(errorBudgetMinutes(99.9, 30)).toBeCloseTo(43.2, 0)
  })

  it('100% SLO has 0 budget', () => {
    expect(errorBudgetMinutes(100, 30)).toBe(0)
  })

  it('99% SLO over 1 day = 14.4 min', () => {
    expect(errorBudgetMinutes(99, 1)).toBeCloseTo(14.4, 0)
  })
})

// ─── errorBudgetRemainingPct ──────────────────────────────────
describe('errorBudgetRemainingPct', () => {
  it('no incidents → 100% remaining', () => {
    expect(errorBudgetRemainingPct(99.9, 30, [])).toBe(100)
  })

  it('incident consuming exactly half the budget → 50% remaining', () => {
    const halfBudgetMs = errorBudgetMinutes(99.9, 30) * 60000 / 2
    const inc = makeInc(86_400_000, halfBudgetMs)
    expect(errorBudgetRemainingPct(99.9, 30, [inc])).toBe(50)
  })

  it('clamps at 0 when budget exhausted', () => {
    const overBudgetMs = errorBudgetMinutes(99.9, 30) * 60000 * 2
    const inc = makeInc(86_400_000, overBudgetMs)
    expect(errorBudgetRemainingPct(99.9, 30, [inc])).toBe(0)
  })

  it('ignores unresolved incidents (no resolved_at)', () => {
    const unresolved = makeInc(3_600_000, null)
    expect(errorBudgetRemainingPct(99.9, 30, [unresolved])).toBe(100)
  })

  it('ignores incidents outside the period', () => {
    const old = makeInc(40 * 86_400_000, 3_600_000)
    expect(errorBudgetRemainingPct(99.9, 30, [old])).toBe(100)
  })
})

// ─── calculateMTTR ─────────────────────────────────────────────
describe('calculateMTTR', () => {
  it('returns null when no resolved incidents', () => {
    expect(calculateMTTR([makeInc(3_600_000, null)])).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(calculateMTTR([])).toBeNull()
  })

  it('computes average recovery time in minutes', () => {
    const inc1 = makeInc(7_200_000, 600_000)   // 10 min
    const inc2 = makeInc(3_600_000, 1_200_000) // 20 min
    expect(calculateMTTR([inc1, inc2])).toBe(15) // avg = 15 min
  })
})

// ─── calculateMTBF ─────────────────────────────────────────────
describe('calculateMTBF', () => {
  it('returns null for fewer than 2 incidents', () => {
    expect(calculateMTBF([])).toBeNull()
    expect(calculateMTBF([makeInc(3_600_000, 600_000)])).toBeNull()
  })

  it('computes average gap between incidents in hours', () => {
    const inc1 = makeInc(7_200_000, 60_000)
    const inc2 = makeInc(3_600_000, 60_000)
    expect(calculateMTBF([inc1, inc2])).toBe(1) // 1 hour between starts
  })
})