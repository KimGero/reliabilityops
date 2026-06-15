import { describe, it, expect } from 'vitest'

// Pure logic extracted from the cron worker — testable without Supabase

type IncidentAction = 'create_incident' | 'silence' | 'resolve_incident' | 'no_op'

interface CheckState {
  isUp: boolean
  consecutiveFails: number
  hasOpenIncident: boolean
}

function deriveAction(s: CheckState, threshold = 3): IncidentAction {
  if (!s.isUp) {
    if (s.consecutiveFails >= threshold && !s.hasOpenIncident) return 'create_incident'
    return 'silence'
  }
  if (s.hasOpenIncident) return 'resolve_incident'
  return 'no_op'
}

describe('incident state machine', () => {
  describe('UP → DOWN transitions', () => {
    it('1st failure is silenced (below threshold)', () =>
      expect(deriveAction({ isUp: false, consecutiveFails: 1, hasOpenIncident: false })).toBe('silence'))

    it('2nd failure is silenced', () =>
      expect(deriveAction({ isUp: false, consecutiveFails: 2, hasOpenIncident: false })).toBe('silence'))

    it('3rd failure with no open incident → creates incident', () =>
      expect(deriveAction({ isUp: false, consecutiveFails: 3, hasOpenIncident: false })).toBe('create_incident'))

    it('4th failure with no open incident → still creates (edge case)', () =>
      expect(deriveAction({ isUp: false, consecutiveFails: 4, hasOpenIncident: false })).toBe('create_incident'))
  })

  describe('DOWN → DOWN (deduplication)', () => {
    it('3rd failure with open incident → silence (no duplicate)', () =>
      expect(deriveAction({ isUp: false, consecutiveFails: 3, hasOpenIncident: true })).toBe('silence'))

    it('10th failure with open incident → still silence', () =>
      expect(deriveAction({ isUp: false, consecutiveFails: 10, hasOpenIncident: true })).toBe('silence'))
  })

  describe('DOWN → UP (recovery)', () => {
    it('recovery with open incident → resolves it', () =>
      expect(deriveAction({ isUp: true, consecutiveFails: 0, hasOpenIncident: true })).toBe('resolve_incident'))
  })

  describe('UP → UP (healthy)', () => {
    it('healthy with no incident → no-op', () =>
      expect(deriveAction({ isUp: true, consecutiveFails: 0, hasOpenIncident: false })).toBe('no_op'))
  })

  describe('custom threshold', () => {
    it('threshold=1 creates on first failure', () =>
      expect(deriveAction({ isUp: false, consecutiveFails: 1, hasOpenIncident: false }, 1)).toBe('create_incident'))

    it('threshold=5: 4 failures still silenced', () =>
      expect(deriveAction({ isUp: false, consecutiveFails: 4, hasOpenIncident: false }, 5)).toBe('silence'))

    it('threshold=5: 5th failure creates', () =>
      expect(deriveAction({ isUp: false, consecutiveFails: 5, hasOpenIncident: false }, 5)).toBe('create_incident'))
  })
})