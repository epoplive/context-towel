import { describe, it, expect } from 'vitest'
import { needsKeyframe, DEFAULT_COMPRESSION_CONFIG } from '../../src/compression'

describe('needsKeyframe', () => {
  it('returns true when deltas reach keyframe interval', () => {
    expect(needsKeyframe(10, DEFAULT_COMPRESSION_CONFIG)).toBe(true)
  })

  it('returns false when deltas are below keyframe interval', () => {
    expect(needsKeyframe(9, DEFAULT_COMPRESSION_CONFIG)).toBe(false)
  })

  it('returns true when deltas exceed keyframe interval', () => {
    expect(needsKeyframe(15, DEFAULT_COMPRESSION_CONFIG)).toBe(true)
  })

  it('returns false for zero deltas', () => {
    expect(needsKeyframe(0, DEFAULT_COMPRESSION_CONFIG)).toBe(false)
  })

  it('respects custom keyframe interval', () => {
    const config = { keyframeInterval: 5, maxVersionsPerPacket: 50 }
    expect(needsKeyframe(4, config)).toBe(false)
    expect(needsKeyframe(5, config)).toBe(true)
    expect(needsKeyframe(6, config)).toBe(true)
  })

  it('handles interval of 1 (every version is a keyframe)', () => {
    const config = { keyframeInterval: 1, maxVersionsPerPacket: 50 }
    expect(needsKeyframe(0, config)).toBe(false)
    expect(needsKeyframe(1, config)).toBe(true)
  })
})

describe('DEFAULT_COMPRESSION_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_COMPRESSION_CONFIG.keyframeInterval).toBe(10)
    expect(DEFAULT_COMPRESSION_CONFIG.maxVersionsPerPacket).toBe(50)
  })
})
