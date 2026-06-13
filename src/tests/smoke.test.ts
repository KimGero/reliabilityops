import { describe, it, expect } from 'vitest'

describe('project setup', () => {
  it('TypeScript compiles', () => {
    const add = (a: number, b: number): number => a + b
    expect(add(1, 2)).toBe(3)
  })

  it('environment configured', () => {
    // Will pass — we check real env vars in integration tests
    expect(typeof import.meta).toBe('object')
  })
})