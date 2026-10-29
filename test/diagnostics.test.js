// Eventos de diagnóstico (src/diagnostics.js): o que cada canal publica,
// sem token, senha, corpo nem query string, e nada muda sem assinante.
import { describe, it, expect, vi, afterEach } from 'vitest'
import diagnostics_channel from 'node:diagnostics_channel'
import { HttpClient } from '../src/client.js'
import { Auth } from '../src/auth.js'
import { CHANNELS, publish } from '../src/diagnostics.js'
import { AuthError, EmptyResponseError, TimeoutError } from '../src/errors.js'

const res = (status, data) => ({ status, text: async () => JSON.stringify(data) })

const subscriptions = []
function listen(name) {
  const events = []
  const fn = (message) => events.push(message)
  diagnostics_channel.subscribe(name, fn)
  subscriptions.push([name, fn])
  return events
}

afterEach(() => {
  for (const [name, fn] of subscriptions.splice(0)) diagnostics_channel.unsubscribe(name, fn)
  vi.unstubAllGlobals()
})

function setup({ retry, timeoutMs } = {}) {
  const auth = new Auth('u@test.com', 'segredo', {
    token: 'tok-secreto',
    properties: [
      { id: 7, nome: 'A' },
      { id: 8, nome: 'B' },
    ],
  })
  const client = new HttpClient({ baseUrl: 'https://api.test', auth, retry, timeoutMs })
  return { auth, client }
}

describe('mb-cliente:request', () => {
  it('publica método, caminho, página, status, tentativa e duração — sem token nem query', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res(200, { count: 1, results: [{ id: 1 }] }))
    )
    const events = listen('mb-cliente:request')
    const { client } = setup()
    await client.get('/tratos/', { page: 2, data_0: '2026-10-01' })
    expect(events).toEqual([
      {
        method: 'GET',
        path: '/tratos/',
        page: 2,
        status: 200,
        error: undefined,
        attempt: 1,
        durationMs: expect.any(Number),
      },
    ])
    const text = JSON.stringify(events)
    expect(text).not.toMatch(/tok-secreto|segredo|data_0|2026-10-01/)
  })

  it('falha de rede: status null e o nome do erro; retry anuncia a próxima tentativa', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed https://api.test/tratos/?x=1'))
      .mockResolvedValueOnce(res(200, { count: 1, results: [{ id: 1 }] }))
    vi.stubGlobal('fetch', fetch)
    const requests = listen('mb-cliente:request')
    const retries = listen('mb-cliente:retry')
    const { client } = setup({ retry: { attempts: 2, backoffMs: 0 } })
    await client.get('/tratos/')
    expect(requests.map((e) => [e.attempt, e.status, e.error])).toEqual([
      [1, null, 'TypeError'],
      [2, 200, undefined],
    ])
    expect(retries).toEqual([
      { method: 'GET', path: '/tratos/', page: undefined, attempt: 1, nextAttempt: 2, delayMs: 0 },
    ])
  })

  it('estouro do prazo e cancelamento viram TimeoutError e AbortError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, { signal }) =>
          new Promise((_, reject) =>
            signal.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')))
          )
      )
    )
    const events = listen('mb-cliente:request')
    const { client } = setup({ timeoutMs: 5 })
    await expect(client.get('/tratos/')).rejects.toBeInstanceOf(TimeoutError)
    const controller = new AbortController()
    const call = client.get('/tratos/', {}, { signal: controller.signal, timeoutMs: 60_000 })
    controller.abort(new Error('parou'))
    await expect(call).rejects.toThrow('parou')
    expect(events.map((e) => e.error)).toEqual(['TimeoutError', 'AbortError'])
  })
})

describe('mb-cliente:empty-response', () => {
  it('publica caminho e página da resposta vazia antes do EmptyResponseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res(200, { count: 0, results: [] }))
    )
    const events = listen('mb-cliente:empty-response')
    const { client } = setup()
    await expect(client.get('/vacinacao/', { page: 3 })).rejects.toBeInstanceOf(EmptyResponseError)
    await expect(client.get('/vacinacao/')).rejects.toBeInstanceOf(EmptyResponseError)
    expect(events).toEqual([
      { method: 'GET', path: '/vacinacao/', page: 3 },
      { method: 'GET', path: '/vacinacao/', page: 1 },
    ])
  })
})

describe('mb-cliente:property-switch e mb-cliente:relogin', () => {
  it('o caminho do evento nunca leva query, nem a fixa dos caminhos internos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res(200, {}))
    )
    const events = listen('mb-cliente:request')
    const { auth, client } = setup()
    await auth.withProperty(client, 7, () => {})
    expect(events.map((e) => e.path)).toEqual(['/usuario/7/selecione-propriedade/'])
  })

  it('cada seleção confirmada publica de/para, restore e geração', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res(200, {}))
    )
    const events = listen('mb-cliente:property-switch')
    const { auth, client } = setup()
    await auth.withProperty(client, 7, () => {})
    await auth.withProperty(client, 8, () => {})
    expect(events).toEqual([
      { from: null, to: 7, restore: false, generation: 1 },
      { from: 7, to: 8, restore: false, generation: 2 },
    ])
  })

  it('relogin bem-sucedido: ok, fazenda reselecionada (restore) e duração', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.includes('login-integracao')
          ? res(200, { token: 't2', fazendas: [{ id: 7 }] })
          : res(200, {})
      )
    )
    const relogins = listen('mb-cliente:relogin')
    const switches = listen('mb-cliente:property-switch')
    const { auth, client } = setup()
    await auth.withProperty(client, 7, () => {})
    await auth.relogin(client)
    expect(relogins).toEqual([
      { ok: true, error: undefined, propertyId: 7, durationMs: expect.any(Number) },
    ])
    // A reseleção do relogin não conta como troca: a geração continua a mesma.
    expect(switches.at(-1)).toEqual({ from: null, to: 7, restore: true, generation: 1 })
    expect(JSON.stringify(relogins)).not.toMatch(/t2|segredo/)
  })

  it('relogin que falha: ok false e o nome do erro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res(400, { detail: 'credenciais' }))
    )
    const relogins = listen('mb-cliente:relogin')
    const { auth, client } = setup()
    await expect(auth.relogin(client)).rejects.toBeInstanceOf(AuthError)
    expect(relogins).toEqual([
      { ok: false, error: 'AuthError', propertyId: null, durationMs: expect.any(Number) },
    ])
  })
})

describe('publish sem assinante', () => {
  it('não monta a mensagem nem publica', () => {
    const channel = { hasSubscribers: false, publish: vi.fn() }
    const message = vi.fn()
    publish(channel, message)
    expect(message).not.toHaveBeenCalled()
    expect(channel.publish).not.toHaveBeenCalled()
  })

  it('os canais têm os nomes documentados', () => {
    expect(Object.values(CHANNELS).map((c) => c.name)).toEqual([
      'mb-cliente:request',
      'mb-cliente:retry',
      'mb-cliente:relogin',
      'mb-cliente:property-switch',
      'mb-cliente:empty-response',
    ])
  })
})
