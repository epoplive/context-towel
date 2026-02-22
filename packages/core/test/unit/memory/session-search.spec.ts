import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryVectorIndex,
  buildSessionRecord,
  findSimilarProblems,
  transferStrategy,
  retrieveKnowledge,
} from '../../../src/memory/session-search'
import type { SessionRecord } from '../../../src/memory/session-search'
import {
  embedText,
  vectorFrom,
  buildProblemState,
  buildSolutionEstimate,
  createTrajectory,
  appendStep,
  resolveTrajectory,
} from '../../../src/memory/vector-state'

function makeSessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: overrides.id ?? `sr-${Math.random().toString(36).slice(2)}`,
    projectId: overrides.projectId ?? 'proj-1',
    description: overrides.description ?? 'test session',
    archetypeId: overrides.archetypeId ?? 'arch-1',
    layer: overrides.layer ?? 'application',
    technique: overrides.technique ?? 'debugging',
    embedding: overrides.embedding ?? embedText('test session'),
    outcome: overrides.outcome ?? {
      success: true,
      totalToolCalls: 5,
      totalDurationMs: 1000,
      archetypeMatchQuality: 0.8,
      totalDeviation: 0.2,
    },
    modifiedFiles: overrides.modifiedFiles ?? ['file1.ts'],
    toolsUsed: overrides.toolsUsed ?? ['read_file', 'edit_file'],
    timestamp: overrides.timestamp ?? Date.now(),
    strategySummary: overrides.strategySummary ?? 'Fixed by editing file',
    tags: overrides.tags ?? ['bug', 'fix'],
  }
}

describe('InMemoryVectorIndex', () => {
  let index: InMemoryVectorIndex

  beforeEach(() => {
    index = new InMemoryVectorIndex()
  })

  describe('insert and get', () => {
    it('inserts and retrieves a record', async () => {
      const record = makeSessionRecord({ id: 'sr-1' })
      await index.insert(record)
      const found = await index.get('sr-1')
      expect(found).toBeDefined()
      expect(found!.id).toBe('sr-1')
    })

    it('returns undefined for non-existent record', async () => {
      expect(await index.get('nope')).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('deletes a record', async () => {
      await index.insert(makeSessionRecord({ id: 'sr-1' }))
      expect(await index.delete('sr-1')).toBe(true)
      expect(await index.get('sr-1')).toBeUndefined()
    })

    it('returns false for non-existent record', async () => {
      expect(await index.delete('nope')).toBe(false)
    })
  })

  describe('search', () => {
    it('returns results sorted by similarity', async () => {
      const query = embedText('fix authentication bug')

      await index.insert(makeSessionRecord({
        id: 'sr-1',
        description: 'fix authentication bug',
        embedding: embedText('fix authentication bug'),
      }))
      await index.insert(makeSessionRecord({
        id: 'sr-2',
        description: 'deploy to production',
        embedding: embedText('deploy to production'),
      }))

      const results = await index.search(query)
      expect(results).toHaveLength(2)
      expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score)
    })

    it('filters by projectId', async () => {
      await index.insert(makeSessionRecord({ id: 'sr-1', projectId: 'p1' }))
      await index.insert(makeSessionRecord({ id: 'sr-2', projectId: 'p2' }))

      const results = await index.search(embedText('test'), { projectId: 'p1' })
      expect(results).toHaveLength(1)
      expect(results[0]!.record.projectId).toBe('p1')
    })

    it('filters by archetypeId', async () => {
      await index.insert(makeSessionRecord({ id: 'sr-1', archetypeId: 'a1' }))
      await index.insert(makeSessionRecord({ id: 'sr-2', archetypeId: 'a2' }))

      const results = await index.search(embedText('test'), { archetypeId: 'a1' })
      expect(results).toHaveLength(1)
    })

    it('filters by onlySuccessful', async () => {
      await index.insert(makeSessionRecord({
        id: 'sr-1',
        outcome: { success: true, totalToolCalls: 1, totalDurationMs: 100, archetypeMatchQuality: 0.5, totalDeviation: 0.1 },
      }))
      await index.insert(makeSessionRecord({
        id: 'sr-2',
        outcome: { success: false, totalToolCalls: 1, totalDurationMs: 100, archetypeMatchQuality: 0.5, totalDeviation: 0.1 },
      }))

      const results = await index.search(embedText('test'), { onlySuccessful: true })
      expect(results).toHaveLength(1)
      expect(results[0]!.record.outcome.success).toBe(true)
    })

    it('filters by tags', async () => {
      await index.insert(makeSessionRecord({ id: 'sr-1', tags: ['auth', 'bug'] }))
      await index.insert(makeSessionRecord({ id: 'sr-2', tags: ['deploy'] }))

      const results = await index.search(embedText('test'), { tags: ['auth'] })
      expect(results).toHaveLength(1)
      expect(results[0]!.record.id).toBe('sr-1')
    })

    it('respects maxResults', async () => {
      for (let i = 0; i < 10; i++) {
        await index.insert(makeSessionRecord({ id: `sr-${i}` }))
      }

      const results = await index.search(embedText('test'), { maxResults: 3 })
      expect(results).toHaveLength(3)
    })

    it('supports euclidean metric', async () => {
      await index.insert(makeSessionRecord({
        id: 'sr-1',
        embedding: vectorFrom([1, 0, 0, 0]) as unknown as Float32Array,
      }))

      const results = await index.search(
        vectorFrom([1, 0, 0, 0]) as unknown as Float32Array,
        { metric: 'euclidean' },
      )
      expect(results).toHaveLength(1)
      expect(results[0]!.score).toBeGreaterThan(0)
    })
  })

  describe('getAll', () => {
    it('returns all records', async () => {
      await index.insert(makeSessionRecord({ id: 'sr-1' }))
      await index.insert(makeSessionRecord({ id: 'sr-2' }))
      const all = await index.getAll()
      expect(all).toHaveLength(2)
    })

    it('filters by projectId', async () => {
      await index.insert(makeSessionRecord({ id: 'sr-1', projectId: 'p1' }))
      await index.insert(makeSessionRecord({ id: 'sr-2', projectId: 'p2' }))
      const all = await index.getAll({ projectId: 'p1' })
      expect(all).toHaveLength(1)
    })
  })

  describe('count', () => {
    it('counts records', async () => {
      await index.insert(makeSessionRecord({ id: 'sr-1' }))
      await index.insert(makeSessionRecord({ id: 'sr-2' }))
      expect(await index.count()).toBe(2)
    })

    it('counts filtered by projectId', async () => {
      await index.insert(makeSessionRecord({ id: 'sr-1', projectId: 'p1' }))
      await index.insert(makeSessionRecord({ id: 'sr-2', projectId: 'p2' }))
      expect(await index.count({ projectId: 'p1' })).toBe(1)
    })
  })
})

describe('session search functions', () => {
  let index: InMemoryVectorIndex

  beforeEach(async () => {
    index = new InMemoryVectorIndex()
    await index.insert(makeSessionRecord({
      id: 'sr-auth',
      description: 'fix authentication token expiration',
      embedding: embedText('fix authentication token expiration'),
      strategySummary: 'Refreshed the token before API calls',
      toolsUsed: ['read_file', 'edit_file'],
      modifiedFiles: ['auth.ts'],
    }))
    await index.insert(makeSessionRecord({
      id: 'sr-deploy',
      description: 'deploy application to production',
      embedding: embedText('deploy application to production'),
      strategySummary: 'Used CI/CD pipeline',
      toolsUsed: ['bash'],
      modifiedFiles: ['deploy.sh'],
    }))
  })

  describe('findSimilarProblems', () => {
    it('finds problems similar to a description', async () => {
      const results = await findSimilarProblems(index, 'authentication token issue')
      expect(results.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('transferStrategy', () => {
    it('transfers strategy from similar sessions', async () => {
      const transfers = await transferStrategy(index, 'auth token expired')
      expect(transfers.length).toBeGreaterThanOrEqual(1)
      // All results should be successful (onlySuccessful=true)
      for (const t of transfers) {
        expect(t.sourceSession.outcome.success).toBe(true)
      }
    })
  })

  describe('retrieveKnowledge', () => {
    it('retrieves knowledge about a topic', async () => {
      const knowledge = await retrieveKnowledge(index, 'authentication')
      expect(knowledge.topic).toBe('authentication')
      expect(knowledge.sessions.length).toBeGreaterThanOrEqual(1)
    })

    it('computes common tools and files', async () => {
      // Insert another auth-related session
      await index.insert(makeSessionRecord({
        id: 'sr-auth2',
        description: 'fix auth middleware',
        embedding: embedText('fix auth middleware'),
        toolsUsed: ['read_file', 'edit_file'],
        modifiedFiles: ['auth.ts', 'middleware.ts'],
      }))

      const knowledge = await retrieveKnowledge(index, 'auth')
      expect(knowledge.commonTools.length).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('buildSessionRecord', () => {
  it('builds a session record from a trajectory', () => {
    const state = buildProblemState('s1', {
      description: 'fix bug in auth',
      activeFiles: ['auth.ts'],
      activeFunctions: ['login'],
      errors: ['401'],
      hypotheses: ['token expired'],
      toolsCalled: ['read_file'],
      phase: 'research',
    })

    const estimate = buildSolutionEstimate({
      expectedFiles: ['auth.ts'],
      changeType: 'condition',
      expectedFileCount: { min: 1, max: 1 },
      expectedToolCalls: { min: 2, max: 5 },
      constraints: [],
    })

    let traj = createTrajectory('t1', 's1', state, estimate)

    const next = buildProblemState('s2', {
      description: 'applied fix',
      activeFiles: ['auth.ts'],
      activeFunctions: ['login'],
      errors: [],
      hypotheses: [],
      toolsCalled: ['read_file', 'edit_file'],
      phase: 'verify',
    })

    traj = appendStep(traj, next, {
      type: 'tool_call',
      toolName: 'edit_file',
      summary: 'Fixed token refresh',
      success: true,
      durationMs: 200,
    })
    traj = resolveTrajectory(traj, true)

    const record = buildSessionRecord(traj, {
      projectId: 'proj-1',
      archetypeId: 'debug.simple',
      layer: 'application',
      technique: 'debugging',
      modifiedFiles: ['auth.ts'],
      strategySummary: 'Refreshed token before API call',
      tags: ['auth', 'bug'],
    })

    expect(record.id).toBe('t1')
    expect(record.projectId).toBe('proj-1')
    expect(record.toolsUsed).toContain('edit_file')
    expect(record.outcome.success).toBe(true)
  })
})
