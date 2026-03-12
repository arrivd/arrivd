// ── Duration Parser ──

const DURATION_RE = /(\d+)(h|m|s)/g

export function parseDuration(input: string): number {
  const tokens: Array<{ value: number; unit: string }> = []
  let match: RegExpExecArray | null

  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((match = DURATION_RE.exec(input)) !== null) {
    tokens.push({ value: Number(match[1]), unit: match[2] })
  }
  DURATION_RE.lastIndex = 0

  if (tokens.length === 0) {
    if (/^\d+$/.test(input.trim())) return Number(input.trim())
    throw new Error(`Invalid duration: '${input}'`)
  }

  let ms = 0
  for (const { value, unit } of tokens) {
    if (unit === 'h') ms += value * 3_600_000
    else if (unit === 'm') ms += value * 60_000
    else if (unit === 's') ms += value * 1_000
  }
  return ms
}

// ── Cron Expression Parser ──

function expandField(field: string, min: number, max: number): Set<number> {
  const result = new Set<number>()

  for (const part of field.split(',')) {
    const trimmed = part.trim()

    if (trimmed === '*') {
      for (let i = min; i <= max; i++) result.add(i)
    } else if (trimmed.includes('/')) {
      const [range, stepStr] = trimmed.split('/')
      const step = Number(stepStr)
      if (Number.isNaN(step) || step <= 0) throw new Error(`Invalid step value: '${trimmed}'`)
      const start = range === '*' ? min : Number(range)
      for (let i = start; i <= max; i += step) result.add(i)
    } else if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-')
      const start = Number(startStr)
      const end = Number(endStr)
      if (Number.isNaN(start) || Number.isNaN(end)) throw new Error(`Invalid range: '${trimmed}'`)
      for (let i = start; i <= end; i++) result.add(i)
    } else {
      const val = Number(trimmed)
      if (Number.isNaN(val)) throw new Error(`Invalid cron value: '${trimmed}'`)
      result.add(val)
    }
  }

  return result
}

export function nextRun(expression: string, after?: Date): Date {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error(`Invalid cron expression: expected 5 fields, got ${fields.length}`)

  const minutes = expandField(fields[0], 0, 59)
  const hours = expandField(fields[1], 0, 23)
  const daysOfMonth = expandField(fields[2], 1, 31)
  const months = expandField(fields[3], 1, 12)
  const daysOfWeek = expandField(fields[4], 0, 6)

  const start = after ?? new Date()
  const candidate = new Date(start)
  // Start from the next minute boundary
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)

  const maxIterations = 366 * 24 * 60 // ~1 year in minutes
  for (let i = 0; i < maxIterations; i++) {
    const month = candidate.getMonth() + 1
    const dom = candidate.getDate()
    const dow = candidate.getDay()
    const hour = candidate.getHours()
    const minute = candidate.getMinutes()

    if (months.has(month) && daysOfMonth.has(dom) && daysOfWeek.has(dow) && hours.has(hour) && minutes.has(minute)) {
      return candidate
    }

    candidate.setMinutes(candidate.getMinutes() + 1)
  }

  throw new Error(`No matching run found within 366 days for expression: '${expression}'`)
}

// ── Previous Run ──

export function previousRun(expression: string, before?: Date): Date {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error(`Invalid cron expression: expected 5 fields, got ${fields.length}`)

  const minutes = expandField(fields[0], 0, 59)
  const hours = expandField(fields[1], 0, 23)
  const daysOfMonth = expandField(fields[2], 1, 31)
  const months = expandField(fields[3], 1, 12)
  const daysOfWeek = expandField(fields[4], 0, 6)

  const start = before ?? new Date()
  const candidate = new Date(start)
  candidate.setSeconds(0, 0)
  // Start from the current minute, step backwards
  candidate.setMinutes(candidate.getMinutes())

  const maxIterations = 366 * 24 * 60
  for (let i = 0; i < maxIterations; i++) {
    candidate.setMinutes(candidate.getMinutes() - 1)

    const month = candidate.getMonth() + 1
    const dom = candidate.getDate()
    const dow = candidate.getDay()
    const hour = candidate.getHours()
    const minute = candidate.getMinutes()

    if (months.has(month) && daysOfMonth.has(dom) && daysOfWeek.has(dow) && hours.has(hour) && minutes.has(minute)) {
      return candidate
    }
  }

  throw new Error(`No matching previous run found within 366 days for expression: '${expression}'`)
}
