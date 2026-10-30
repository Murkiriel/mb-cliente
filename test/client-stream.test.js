import { describe, it, expect, vi, afterEach } from 'vitest'
import { HttpClient } from '../src/client.js'
import { Auth } from '../src/auth.js'
import {
  RateLimitError,
  ServerError,
  NotFoundError,
  NetworkError,
  TimeoutError,
  InvalidResponseError,
  AuthError,
} from '../src/errors.js'

const enc = new TextEncoder()

// Resposta real (Response do Node) com o corpo em pedaços; `failAfter` corta
// a conexão depois de N pedaços, e `hang` deixa o corpo pendurado até o abort.
function streamed(text, { size = 5, failAfter, hang = false, signal } = {}) {
  const bytes = enc.encode(text)
  let i = 0
  let sent = 0
  return new Response(
    new ReadableStream({
      start(controller) {
        signal?.addEventListener('abort', () => controller.error(signal.reason))
      },
      pull(controller) {
        if (failAfter !== undefined && sent >= failAfter) {
          controller.error(new TypeError('terminated'))
          return
        }
        if (i >= bytes.length) {
          if (!hang) controller.close()
          return new Promise(() => {})
        }
        controller.enqueue(bytes.slice(i, i + size))
        i += size
        sent++
      },
    }),
    { status: 200 }
  )
}

const json = (status, data) => new Response(JSON.stringify(data), { status })

function makeClient(options = {}) {
  const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
  return new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000, ...options })
}

function collector() {
  const batches = []
  return { batches, onBatch: async (items) => batches.push(items) }
}

const BODY = JSON.stringify({ dados: [{ id: 1 }, { id: 2 }, { id: 3 }] })

afterEach(() => vi.unstubAllGlobals())

describe('HttpClient.getStream', () => {
  it('entrega a lista em lotes, com a autenticação do get()', async () => {
    const fetch = vi.fn(async () => streamed(BODY))
    vi.stubGlobal('fetch', fetch)
    const { batches, onBatch } = collector()
    const res = await makeClient().getStream('/integracaobi/x', undefined, {
      field: 'dados',
      batchSize: 2,
      onBatch,
    })
    expect(res).toEqual({ count: 3 })
    expect(batches).toEqual([[{ id: 1 }, { id: 2 }], [{ id: 3 }]])
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe('https://mb.test/integracaobi/x')
    expect(opts.headers.Authorization).toBe('JWT tok')
  })

  it('sem a lista: envelope vazio é zero registros; { detail } e HTML seguem a classificação', async () => {
    const { onBatch } = collector()
    const opts = { field: 'dados', batchSize: 2, onBatch }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, {}))
    )
    expect(await makeClient().getStream('/x', undefined, opts)).toEqual({ count: 0 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, { detail: 'Calma' }))
    )
    await expect(makeClient().getStream('/x', undefined, opts)).rejects.toThrow(RateLimitError)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>', { status: 200 }))
    )
    await expect(makeClient().getStream('/x', undefined, opts)).rejects.toThrow(
      InvalidResponseError
    )
  })

  it('erros HTTP vêm do corpo como texto, como no get()', async () => {
    const { onBatch } = collector()
    const opts = { field: 'dados', batchSize: 2, onBatch }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(500, { erro: 1 }))
    )
    await expect(makeClient().getStream('/x', undefined, opts)).rejects.toThrow(ServerError)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(404, { detail: 'não' }))
    )
    await expect(makeClient().getStream('/x', undefined, opts)).rejects.toThrow(NotFoundError)
  })

  it('401: reloga e lê em fluxo na repetição', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { token: 'novo', propriedades: [] }))
      .mockResolvedValueOnce(streamed(BODY))
    vi.stubGlobal('fetch', fetch)
    const { batches, onBatch } = collector()
    const res = await makeClient().getStream('/x', undefined, {
      field: 'dados',
      batchSize: 10,
      onBatch,
    })
    expect(res).toEqual({ count: 3 })
    expect(batches).toHaveLength(1)
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('JWT novo')
  })

  it('401 na repetição é AuthError', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(401, {}))
        .mockResolvedValueOnce(json(200, { token: 'novo', propriedades: [] }))
        .mockResolvedValueOnce(json(401, {}))
    )
    const { onBatch } = collector()
    await expect(
      makeClient().getStream('/x', undefined, { field: 'dados', batchSize: 1, onBatch })
    ).rejects.toThrow(AuthError)
  })

  it('erro do onBatch sai como foi lançado, nunca como erro de rede', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamed(BODY))
    )
    const boom = new Error('banco caiu')
    await expect(
      makeClient({ retry: { attempts: 3, backoffMs: 1 } }).getStream('/x', undefined, {
        field: 'dados',
        batchSize: 1,
        onBatch: async () => {
          throw boom
        },
      })
    ).rejects.toBe(boom)
  })

  it('JSON inválido no meio é InvalidResponseError, sem nova tentativa', async () => {
    const fetch = vi.fn(async () => streamed('{"dados": [{"a": 1}, 5]}'))
    vi.stubGlobal('fetch', fetch)
    const { onBatch } = collector()
    await expect(
      makeClient({ retry: { attempts: 3, backoffMs: 1 } }).getStream('/x', undefined, {
        field: 'dados',
        batchSize: 1,
        onBatch,
      })
    ).rejects.toThrow(InvalidResponseError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('conexão cortada antes do 1º lote é repetida; depois dele, não', async () => {
    const big = JSON.stringify({ dados: Array.from({ length: 20 }, (_, id) => ({ id })) })
    // antes de qualquer lote: corta no 1º pedaço e depois funciona
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(streamed(big, { failAfter: 1 }))
      .mockResolvedValueOnce(streamed(big))
    vi.stubGlobal('fetch', fetch)
    const a = collector()
    const client = makeClient({ retry: { attempts: 3, backoffMs: 1 } })
    expect(
      await client.getStream('/x', undefined, { field: 'dados', batchSize: 5, onBatch: a.onBatch })
    ).toEqual({ count: 20 })
    expect(fetch).toHaveBeenCalledTimes(2)

    // depois de entregar lotes: NetworkError na hora, sem repetir
    const fetch2 = vi.fn(async () => streamed(big, { size: 10, failAfter: 10 }))
    vi.stubGlobal('fetch', fetch2)
    const b = collector()
    await expect(
      client.getStream('/x', undefined, { field: 'dados', batchSize: 2, onBatch: b.onBatch })
    ).rejects.toThrow(NetworkError)
    expect(b.batches.length).toBeGreaterThan(0)
    expect(fetch2).toHaveBeenCalledTimes(1)
  })

  it('corpo pendurado estoura o prazo (o prazo cobre a leitura inteira)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, { signal }) => streamed('{"dados": [{"a": 1}', { hang: true, signal }))
    )
    const { onBatch } = collector()
    await expect(
      makeClient({ timeoutMs: 30 }).getStream('/x', undefined, {
        field: 'dados',
        batchSize: 1,
        onBatch,
      })
    ).rejects.toThrow(TimeoutError)
  })
})
