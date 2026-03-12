import { DeadLetterQueue } from './dlq'
import type { DlqEntry } from './types'
import { describe, expect, test } from 'bun:test'

function makeEntry(id = 'dlq_1'): DlqEntry {
  return {
    id,
    subscriberId: 'sub_1',
    endpoint: 'https://example.com/hook',
    secret: 'test-secret',
    event: { event: 'test', data: {} },
    error: 'Connection refused',
    failedAt: Date.now(),
    attempts: 5,
  }
}

describe('DeadLetterQueue', () => {
  test('add and list entries', () => {
    const dlq = new DeadLetterQueue()
    const entry = makeEntry()
    dlq.add(entry)

    expect(dlq.list()).toEqual([entry])
  })

  test('list returns a copy', () => {
    const dlq = new DeadLetterQueue()
    dlq.add(makeEntry())

    const list = dlq.list()
    list.pop()
    expect(dlq.list()).toHaveLength(1)
  })

  test('remove deletes an entry by id', () => {
    const dlq = new DeadLetterQueue()
    dlq.add(makeEntry('a'))
    dlq.add(makeEntry('b'))
    dlq.remove('a')

    expect(dlq.list()).toHaveLength(1)
    expect(dlq.list()[0].id).toBe('b')
  })

  test('get returns entry by id', () => {
    const dlq = new DeadLetterQueue()
    const entry = makeEntry('a')
    dlq.add(entry)

    expect(dlq.get('a')).toEqual(entry)
  })

  test('get returns undefined for missing id', () => {
    const dlq = new DeadLetterQueue()

    expect(dlq.get('missing')).toBeUndefined()
  })

  test('purge clears all entries', () => {
    const dlq = new DeadLetterQueue()
    dlq.add(makeEntry('a'))
    dlq.add(makeEntry('b'))
    dlq.purge()

    expect(dlq.list()).toHaveLength(0)
  })

  test('size returns entry count', () => {
    const dlq = new DeadLetterQueue()

    expect(dlq.size()).toBe(0)
    dlq.add(makeEntry())
    expect(dlq.size()).toBe(1)
  })

  test('evicts oldest entries when at capacity', () => {
    const dlq = new DeadLetterQueue(3)
    dlq.add(makeEntry('a'))
    dlq.add(makeEntry('b'))
    dlq.add(makeEntry('c'))
    dlq.add(makeEntry('d'))

    expect(dlq.size()).toBe(3)
    expect(dlq.get('a')).toBeUndefined()
    expect(dlq.get('b')).toBeDefined()
    expect(dlq.get('d')).toBeDefined()
  })
})
