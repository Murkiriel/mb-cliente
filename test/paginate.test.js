import { describe, it, expect, vi } from 'vitest'
import { paginate } from '../src/helpers/paginate.js'
import { paginate as rootPaginate } from '../index.js'
import { ValidationError } from '../src/errors.js'

// Método de página falso: n páginas, hasMore até a última.
function makePages(n) {
  return vi.fn(async ({ page }) => ({
    items: [{ id: page }],
    count: n,
    hasMore: page < n,
    nextPage: page < n ? page + 1 : null,
  }))
}

async function collect(gen) {
  const out = []
  for await (const r of gen) out.push(r)
  return out
}

describe('paginate', () => {
  it('é exportado na raiz', () => {
    expect(rootPaginate).toBe(paginate)
  })

  it('percorre até hasMore false, repassando os params e a página', async () => {
    const fetchPage = makePages(3)
    const r = await collect(paginate(fetchPage, { from: '2026-10-01', extraParams: { a: 1 } }))
    expect(r.map((p) => [p.page, p.items[0].id])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ])
    expect(fetchPage).toHaveBeenNthCalledWith(1, {
      from: '2026-10-01',
      extraParams: { a: 1 },
      page: 1,
    })
  })

  it('page inicial, maxPages e break param a iteração', async () => {
    const fetchPage = makePages(10)
    expect(
      (await collect(paginate(fetchPage, { page: 4, maxPages: 2 }))).map((p) => p.page)
    ).toEqual([4, 5])
    let reads = 0
    for await (const _ of paginate(fetchPage)) {
      if (++reads === 1) break
    }
    expect(reads).toBe(1)
  })

  it('allowEmpty e signal: allowEmpty só na primeira chamada, signal em todas', async () => {
    const fetchPage = makePages(2)
    const signal = new AbortController().signal
    await collect(paginate(fetchPage, { allowEmpty: true, signal }))
    expect(fetchPage.mock.calls[0][0]).toEqual({ page: 1, allowEmpty: true, signal })
    expect(fetchPage.mock.calls[1][0]).toEqual({ page: 2, signal })
  })

  it('espera delayMs entre páginas (não antes da primeira)', async () => {
    vi.useFakeTimers()
    try {
      const fetchPage = makePages(2)
      const it = paginate(fetchPage, { delayMs: 1000 })
      await it.next()
      const second = it.next()
      await vi.advanceTimersByTimeAsync(999)
      expect(fetchPage).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      await second
      expect(fetchPage).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('signal abortado durante a espera interrompe com o reason', async () => {
    const ctl = new AbortController()
    const it = paginate(makePages(2), { delayMs: 60_000, signal: ctl.signal })
    await it.next()
    const second = it.next()
    ctl.abort(new Error('parou'))
    await expect(second).rejects.toThrow('parou')
  })

  it.each([
    [{ page: 0 }, 'page'],
    [{ page: 1.5 }, 'page'],
    [{ maxPages: 0 }, 'maxPages'],
    [{ delayMs: -1 }, 'delayMs'],
    [{ delayMs: Number.NaN }, 'delayMs'],
  ])('%o → ValidationError em %s', async (params, field) => {
    const err = await paginate(makePages(1), params)
      .next()
      .catch((e) => e)
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.field).toBe(field)
  })
})
