import { MemoryQueue } from './queue'
import type { DeliveryJob } from './types'
import { describe, expect, test } from 'bun:test'

function makeJob(id = 'job_1'): DeliveryJob {
  return {
    id,
    subscriberId: 'sub_1',
    endpoint: 'https://example.com/hook',
    event: { event: 'test', data: {} },
    secret: 'secret',
    attempt: 0,
  }
}

describe('MemoryQueue', () => {
  test('enqueue and dequeue a job', () => {
    const queue = new MemoryQueue()
    const job = makeJob()
    queue.enqueue(job)

    expect(queue.dequeue()).toEqual(job)
  })

  test('dequeue returns null when empty', () => {
    const queue = new MemoryQueue()

    expect(queue.dequeue()).toBeNull()
  })

  test('dequeue is FIFO', () => {
    const queue = new MemoryQueue()
    queue.enqueue(makeJob('a'))
    queue.enqueue(makeJob('b'))

    expect(queue.dequeue()?.id).toBe('a')
    expect(queue.dequeue()?.id).toBe('b')
  })

  test('size tracks queue length', () => {
    const queue = new MemoryQueue()

    expect(queue.size()).toBe(0)
    queue.enqueue(makeJob())
    expect(queue.size()).toBe(1)
    queue.dequeue()
    expect(queue.size()).toBe(0)
  })
})
