import { describe, it, expect, vi, afterEach } from 'vitest'
import { HttpClient } from '../src/client.js'
import { Auth } from '../src/auth.js'
import {
  AuthError,
  ServerError,
  RateLimitError,
  InvalidPageError,
  EmptyResponseError,
  TimeoutError,
  ClientError,
  NetworkError,
  InvalidResponseError,
  ValidationError,
} from '../src/errors.js'

function makeFetch(...responses) {
  let i = 0
  return vi
    .fn()
    .mockImplementation(() => Promise.resolve(responses[i++] ?? responses[responses.length - 1]))
}

function makeRes(status, data) {
  return {
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HttpClient.postRaw relogin em 401', () => {
  it('faz relogin e repete a chamada ao receber 401 com token pré-existente', async () => {
    const fetch = makeFetch(
      makeRes(401, {}), // 1ª tentativa: token expirado
      makeRes(200, { token: 'new-tok', propriedades: [] }), // login → novo token
      makeRes(200, { dados: true }) // 2ª tentativa: sucesso
    )
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass', { token: 'old-tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const result = await client.postRaw('/usuario/1/selecione-propriedade/', null)
    expect(result).toEqual({ dados: true })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('lança AuthError imediatamente se 401 durante o próprio login (suppressRelogin)', async () => {
    const fetch = makeFetch(makeRes(401, {}))
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'wrong-pass')
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(auth.login(client)).rejects.toBeInstanceOf(AuthError)
    expect(fetch).toHaveBeenCalledTimes(1) // nenhuma tentativa de relogin
  })

  it('não tenta relogin em postRaw sem token (não autenticado)', async () => {
    const fetch = makeFetch(makeRes(401, {}))
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass') // sem token
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.postRaw('/usuario/1/selecione-propriedade/', null)).rejects.toBeInstanceOf(
      AuthError
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('não envia Content-Type quando body é null', async () => {
    const fetch = makeFetch(makeRes(200, { dados: true }))
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await client.postRaw('/rota/', null)
    const opts = fetch.mock.calls[0][1]
    expect(opts.headers['Content-Type']).toBeUndefined()
    expect(opts.body).toBeUndefined()
  })

  it('com corpo: Content-Type JSON, corpo serializado e Authorization do token', async () => {
    const fetch = makeFetch(makeRes(200, { dados: true }))
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await client.postRaw('/rota/', { a: 1 })
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe('https://mb.test/rota/')
    expect(opts).toMatchObject({
      method: 'POST',
      body: '{"a":1}',
      headers: { 'Content-Type': 'application/json', Authorization: 'JWT tok', Dispositivo: '8' },
    })
  })

  it('sem token: vai sem Authorization (não recusa antes da rede, ao contrário de get/post)', async () => {
    const fetch = makeFetch(makeRes(200, { token: 't' }))
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass')
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.postRaw('/rota/', { a: 1 })).resolves.toEqual({ token: 't' })
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
    await expect(client.post('/rota/', { a: 1 })).rejects.toThrow(
      'Não autenticado — chame connect() primeiro'
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('401 sem token e 401 na repetição: AuthError "Autenticação falhou"; get: "Relogin falhou"', async () => {
    vi.stubGlobal('fetch', makeFetch(makeRes(401, {})))
    const noTokenClient = new HttpClient({
      baseUrl: 'https://mb.test',
      auth: new Auth('u@test.com', 'pass'),
      timeoutMs: 5000,
    })
    await expect(noTokenClient.postRaw('/rota/', null)).rejects.toThrow('Autenticação falhou')

    const fetch = makeFetch(
      makeRes(401, {}),
      makeRes(200, { token: 'novo', propriedades: [] }),
      makeRes(401, {})
    )
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'velho' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })
    await expect(client.postRaw('/rota/', null)).rejects.toThrow('Autenticação falhou')
    expect(fetch).toHaveBeenCalledTimes(3) // original + login + uma repetição

    vi.stubGlobal(
      'fetch',
      makeFetch(makeRes(401, {}), makeRes(200, { token: 'n2', propriedades: [] }), makeRes(401, {}))
    )
    await expect(client.get('/x/')).rejects.toThrow('Relogin falhou — credenciais inválidas')
  })

  it('HTTP 5xx → ServerError', async () => {
    const fetch = makeFetch(makeRes(503, { erro: 'indisponível' }))
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.postRaw('/rota/', { a: 1 })).rejects.toBeInstanceOf(ServerError)
  })

  it('{ detail } no corpo (200) → RateLimitError, evitando marcar propriedade como selecionada em falso', async () => {
    const fetch = makeFetch(makeRes(200, { detail: 'Request was throttled.' }))
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.postRaw('/usuario/1/selecione-propriedade/', null)).rejects.toBeInstanceOf(
      RateLimitError
    )
  })

  it('404 com { detail } → ClientError, NÃO RateLimitError', async () => {
    const fetch = makeFetch(makeRes(404, { detail: 'Not found.' }))
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const err = await client.postRaw('/usuario/1/selecione-propriedade/', null).catch((e) => e)
    expect(err).toBeInstanceOf(ClientError)
    expect(err).not.toBeInstanceOf(RateLimitError)
  })

  it('{ detail: "Página inválida." } no corpo (200) → InvalidPageError, NÃO RateLimitError', async () => {
    const fetch = makeFetch(makeRes(200, { detail: 'Página inválida.' }))
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const err = await client.postRaw('/usuario/1/selecione-propriedade/', null).catch((e) => e)
    expect(err).toBeInstanceOf(InvalidPageError)
    expect(err).not.toBeInstanceOf(RateLimitError)
  })
})

describe('HttpClient.get / #request (GET, usado pelo grid ERP e módulos BI)', () => {
  it('faz GET com Authorization/Dispositivo, sem Content-Type', async () => {
    const fetch = makeFetch(makeRes(200, { count: 1, results: [{ id: 1 }] }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const result = await client.get('/materiais/', { page: 1 })

    expect(result.results).toHaveLength(1)
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe('https://mb.test/materiais/?page=1')
    expect(opts.headers['Authorization']).toBe('JWT tok')
    expect(opts.headers['Content-Type']).toBeUndefined()
  })

  it('filtra params undefined/null da query string', async () => {
    const fetch = makeFetch(makeRes(200, { count: 0, results: [{ id: 1 }] }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await client.get('/materiais/', { page: 1, data_0: undefined, data_1: null })

    expect(fetch.mock.calls[0][0]).toBe('https://mb.test/materiais/?page=1')
  })

  it('401 → relogin automático e repete o GET uma vez', async () => {
    const fetch = makeFetch(
      makeRes(401, {}),
      makeRes(200, { token: 'new-tok', propriedades: [] }),
      makeRes(200, { count: 0, results: [{ id: 1 }] })
    )
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'old-tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const result = await client.get('/materiais/')
    expect(result.results).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('401 na segunda tentativa (relogin falhou) → AuthError, sem loop', async () => {
    const fetch = makeFetch(makeRes(401, {}), makeRes(401, {}))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'old-tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.get('/materiais/')).rejects.toBeInstanceOf(AuthError)
  })

  it('relogin bem-sucedido mas a requisição repetida ainda recebe 401 → AuthError, sem 3ª tentativa', async () => {
    const fetch = makeFetch(
      makeRes(401, {}), // 1ª tentativa do GET
      makeRes(200, { token: 'new-tok', propriedades: [] }), // relogin funciona
      makeRes(401, {}) // GET repetido ainda rejeitado
    )
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'old-tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.get('/materiais/')).rejects.toBeInstanceOf(AuthError)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('HTTP 5xx → ServerError', async () => {
    const fetch = makeFetch(makeRes(500, { erro: 'boom' }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.get('/materiais/')).rejects.toBeInstanceOf(ServerError)
  })

  it('{ detail } na resposta → RateLimitError', async () => {
    const fetch = makeFetch(makeRes(200, { detail: 'throttled' }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.get('/vacinacao/')).rejects.toBeInstanceOf(RateLimitError)
  })

  it('404 com { detail } → ClientError, NÃO RateLimitError (a limitação real do servidor só vem em 200)', async () => {
    const fetch = makeFetch(makeRes(404, { detail: 'Not found.' }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const err = await client.get('/slug-errado/').catch((e) => e)
    expect(err).toBeInstanceOf(ClientError)
    expect(err).not.toBeInstanceOf(RateLimitError)
    expect(err.statusCode).toBe(404)
  })

  it('{ detail: "Página inválida." } (200) → InvalidPageError, NÃO RateLimitError', async () => {
    const fetch = makeFetch(makeRes(200, { detail: 'Página inválida.' }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const err = await client.get('/medicoes_pesagem/', { page: 99 }).catch((e) => e)
    expect(err).toBeInstanceOf(InvalidPageError)
    expect(err).not.toBeInstanceOf(RateLimitError)
  })

  it('{ detail: "Invalid page." } (200, variação em inglês) → InvalidPageError', async () => {
    const fetch = makeFetch(makeRes(200, { detail: 'Invalid page.' }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.get('/medicoes_pesagem/', { page: 1 })).rejects.toBeInstanceOf(
      InvalidPageError
    )
  })

  it('403 com { detail } → ClientError', async () => {
    const fetch = makeFetch(makeRes(403, { detail: 'Permission denied.' }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.get('/materiais/')).rejects.toBeInstanceOf(ClientError)
  })

  it('count:0 + results:[] → EmptyResponseError (limite silencioso de requisições)', async () => {
    const fetch = makeFetch(makeRes(200, { count: 0, results: [] }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.get('/vacinacao/', { page: 3 })).rejects.toBeInstanceOf(EmptyResponseError)
  })

  it('EmptyResponseError.page cai para 1 quando params não tem page', async () => {
    const fetch = makeFetch(makeRes(200, { count: 0, results: [] }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    try {
      await client.get('/vacinacao/')
      throw new Error('deveria ter lançado')
    } catch (e) {
      expect(e).toBeInstanceOf(EmptyResponseError)
      expect(e.page).toBe(1)
    }
  })

  it('URL sem "?" quando todos os params são filtrados (undefined/null)', async () => {
    const fetch = makeFetch(makeRes(200, { count: 1, results: [{ id: 1 }] }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await client.get('/materiais/', { data_0: undefined, data_1: null })

    expect(fetch.mock.calls[0][0]).toBe('https://mb.test/materiais/')
  })

  it('timeout (AbortError) → TimeoutError', async () => {
    const fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 10 })

    await expect(client.get('/tratos/')).rejects.toBeInstanceOf(TimeoutError)
  })

  it('timeoutMs por chamada troca o prazo da instância só naquela chamada', async () => {
    const fetch = vi.fn().mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 60_000 })

    const err = await client.post('/recalculo/', {}, { timeoutMs: 10 }).catch((e) => e)
    expect(err).toBeInstanceOf(TimeoutError)
    expect(err.timeoutMs).toBe(10)
    expect(err.mayHaveSucceeded).toBe(true)
    expect(err.message).toBe('Timeout após 10ms: https://mb.test/recalculo/')
  })

  it.each([0, -1, Infinity, '10'])(
    'timeoutMs por chamada inválido (%s) → ValidationError',
    async (v) => {
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
      const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

      await expect(client.get('/x/', {}, { timeoutMs: v })).rejects.toBeInstanceOf(ValidationError)
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('falha de rede transitória (sem retry configurado) propaga direto', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.get('/materiais/')).rejects.toBeInstanceOf(NetworkError)
    expect(fetch).toHaveBeenCalledTimes(1) // sem nova tentativa por padrão
  })
})

describe('HttpClient.put / .patch / .delete (escrita)', () => {
  it('post() com corpo {count:0, results:[]} NÃO lança EmptyResponseError (guarda é só GET)', async () => {
    const fetch = makeFetch(makeRes(200, { count: 0, results: [] }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const result = await client.post('/materiais/', { nome: 'X' })
    expect(result).toEqual({ count: 0, results: [] })
  })

  it('put() envia PUT com Content-Type e body serializado', async () => {
    const fetch = makeFetch(makeRes(200, { id: 1, atualizado: true }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const result = await client.put('/materiais/1/', { nome: 'Novo nome' })

    expect(result).toEqual({ id: 1, atualizado: true })
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe('https://mb.test/materiais/1/')
    expect(opts.method).toBe('PUT')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body)).toEqual({ nome: 'Novo nome' })
  })

  it('patch() envia PATCH com body parcial', async () => {
    const fetch = makeFetch(makeRes(200, { id: 1, ativo: false }))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    const result = await client.patch('/contato/1/', { ativo: false })

    expect(result).toEqual({ id: 1, ativo: false })
    const opts = fetch.mock.calls[0][1]
    expect(opts.method).toBe('PATCH')
    expect(JSON.parse(opts.body)).toEqual({ ativo: false })
  })

  it('delete() envia DELETE sem body', async () => {
    const fetch = makeFetch(makeRes(200, {}))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await client.delete('/contato/1/')

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe('https://mb.test/contato/1/')
    expect(opts.method).toBe('DELETE')
    expect(opts.body).toBeUndefined()
  })
})

describe('HttpClient: retry com espera crescente (opcional) para falhas de rede transitórias', () => {
  it('com retry.attempts:3, tenta 3x e sucede na última em falha de rede', async () => {
    let calls = 0
    const fetch = vi.fn().mockImplementation(() => {
      calls++
      if (calls < 3) return Promise.reject(new TypeError('fetch failed'))
      return Promise.resolve(makeRes(200, { count: 0, results: [{ id: 1 }] }))
    })
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth,
      timeoutMs: 5000,
      retry: { attempts: 3, backoffMs: 1 },
    })

    const result = await client.get('/materiais/')
    expect(result.results).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('esgota as tentativas e propaga o erro de rede', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth,
      timeoutMs: 5000,
      retry: { attempts: 3, backoffMs: 1 },
    })

    await expect(client.get('/materiais/')).rejects.toThrow(NetworkError)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('nunca repete POST, mesmo com retry configurado', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth,
      timeoutMs: 5000,
      retry: { attempts: 3, backoffMs: 1 },
    })

    await expect(client.post('/entrada/', { a: 1 })).rejects.toThrow('fetch failed')
    expect(fetch).toHaveBeenCalledTimes(1) // POST nunca é retentado
  })

  it('nunca repete em timeout (AbortError), mesmo com retry configurado', async () => {
    const fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth,
      timeoutMs: 10,
      retry: { attempts: 3, backoffMs: 1 },
    })

    await expect(client.get('/tratos/')).rejects.toBeInstanceOf(TimeoutError)
    expect(fetch).toHaveBeenCalledTimes(1) // timeout deliberado nunca é retentado
  })
})

// Auth e HttpClient REAIS, com fetch roteado por URL: cobrem as interações
// que os testes com cliente falso não alcançam (relogin dentro do relogin,
// 401 que chega depois de o token já ter sido trocado).
describe('Relogin integrado (Auth + HttpClient reais)', () => {
  const LOGIN_OK = { token: 'tok-new', propriedades: [{ propriedade_id: 5, nome: 'Fazenda X' }] }

  function deferred() {
    let resolve
    const promise = new Promise((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  async function setup(route) {
    const fetch = vi.fn(async (url, opts) => route(url, opts))
    vi.stubGlobal('fetch', fetch)
    const auth = new Auth('u@test.com', 'pass', {
      token: 'tok-old',
      properties: [{ id: 5, nome: 'Fazenda X' }],
    })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })
    return { fetch, auth, client }
  }

  const isLogin = (url) => url.endsWith('/login-integracao/')
  const isSelect = (url) => url.includes('/selecione-propriedade/')

  it('401 na reseleção dentro do relogin lança AuthError em vez de travar', async () => {
    let selects = 0
    const { fetch, auth, client } = await setup((url) => {
      if (isLogin(url)) return makeRes(200, LOGIN_OK)
      if (isSelect(url)) return makeRes(++selects === 1 ? 200 : 401, {})
      return makeRes(401, {})
    })
    await auth.selectProperty(client, 5)

    await expect(client.get('/x/')).rejects.toBeInstanceOf(AuthError)
    // GET (401) + login + reseleção (401) — e nada mais
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://mb.test/usuario/5/selecione-propriedade/?format=json',
      'https://mb.test/x/',
      'https://mb.test/login-integracao/',
      'https://mb.test/usuario/5/selecione-propriedade/?format=json',
    ])
  })

  it('o POST de login do relogin não leva o JWT vencido', async () => {
    const { fetch, client } = await setup((url, opts) => {
      if (isLogin(url)) return makeRes(200, LOGIN_OK)
      return makeRes(opts.headers.Authorization === 'JWT tok-new' ? 200 : 401, { ok: true })
    })
    await expect(client.get('/x/')).resolves.toEqual({ ok: true })
    const loginCall = fetch.mock.calls.find(([url]) => isLogin(url))
    expect(loginCall[1].headers.Authorization).toBeUndefined()
  })

  it('401 que chega depois de o relogin terminar só repete, sem novo login', async () => {
    const inFlight = []
    const { fetch, client } = await setup((url, opts) => {
      if (isLogin(url)) return makeRes(200, LOGIN_OK)
      if (opts.headers.Authorization === 'JWT tok-new') return makeRes(200, { ok: url })
      const d = deferred()
      inFlight.push(d)
      return d.promise
    })

    const a = client.get('/a/')
    const b = client.get('/b/')
    await vi.waitFor(() => expect(inFlight).toHaveLength(2))

    inFlight[0].resolve(makeRes(401, {}))
    await expect(a).resolves.toEqual({ ok: 'https://mb.test/a/' })
    inFlight[1].resolve(makeRes(401, {})) // saiu com tok-old, mas o token já é outro
    await expect(b).resolves.toEqual({ ok: 'https://mb.test/b/' })

    expect(fetch.mock.calls.filter(([url]) => isLogin(url))).toHaveLength(1)
  })

  it('o mesmo vale para postRaw: 401 com token já trocado não reloga', async () => {
    const inFlight = deferred()
    let first = true
    const { fetch, auth, client } = await setup((url, opts) => {
      if (isLogin(url)) return makeRes(200, LOGIN_OK)
      if (first) {
        first = false
        return inFlight.promise
      }
      return makeRes(opts.headers.Authorization === 'JWT tok-new' ? 200 : 401, { ok: true })
    })

    const p = client.postRaw('/rota/', null)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await auth.relogin(client) // outra chamada renovou o token nesse meio-tempo
    inFlight.resolve(makeRes(401, {}))

    await expect(p).resolves.toEqual({ ok: true })
    expect(fetch.mock.calls.filter(([url]) => isLogin(url))).toHaveLength(1)
  })

  it('postRaw com anonymous: true não manda Authorization mesmo autenticado', async () => {
    const { fetch, client } = await setup(() => makeRes(200, { ok: true }))
    await client.postRaw('/rota/', null, { anonymous: true })
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('o corpo do 401 final vai para serverMessage do AuthError', async () => {
    const { client } = await setup((url) => {
      if (isLogin(url)) return makeRes(200, LOGIN_OK)
      return makeRes(401, { detail: 'Signature has expired.' })
    })
    const err = await client.get('/x/').catch((e) => e)
    expect(err).toBeInstanceOf(AuthError)
    expect(err.serverMessage).toBe('{"detail":"Signature has expired."}')
  })
})

describe('HttpClient: timeout, cancelamento e falha de rede', () => {
  const auth = () => new Auth('u@test.com', 'pass', { token: 'tok' })

  // Um fetch que respeita o signal como o nativo: rejeita com AbortError
  // quando o signal aborta (na requisição ou na leitura do corpo).
  function abortError() {
    return new DOMException('This operation was aborted', 'AbortError')
  }
  function pendingUntilAbort(signal) {
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(abortError()))
    })
  }

  it('cabeçalhos chegam mas o corpo trava → TimeoutError (o prazo cobre o corpo)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, opts) => ({ status: 200, text: () => pendingUntilAbort(opts.signal) }))
    )
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth: auth(), timeoutMs: 20 })
    const err = await client.get('/x/').catch((e) => e)
    expect(err).toBeInstanceOf(TimeoutError)
    expect(err).toMatchObject({ method: 'GET', timeoutMs: 20, mayHaveSucceeded: false })
    expect(err.cause.name).toBe('AbortError')
  })

  it('timeout numa escrita marca mayHaveSucceeded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, opts) => pendingUntilAbort(opts.signal))
    )
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth: auth(), timeoutMs: 10 })
    const err = await client.put('/contato/1/', { a: 1 }).catch((e) => e)
    expect(err).toBeInstanceOf(TimeoutError)
    expect(err).toMatchObject({ method: 'PUT', mayHaveSucceeded: true })
  })

  it('signal da instância já abortado: lança o reason sem chamar o fetch', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const ctl = new AbortController()
    ctl.abort(new Error('desligando'))
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth: auth(),
      timeoutMs: 5000,
      signal: ctl.signal,
    })
    await expect(client.get('/x/')).rejects.toThrow('desligando')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('signal da chamada abortado durante a requisição: propaga o reason, não TimeoutError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, opts) => pendingUntilAbort(opts.signal))
    )
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth: auth(), timeoutMs: 5000 })
    const ctl = new AbortController()
    const p = client.get('/x/', {}, { signal: ctl.signal })
    ctl.abort()
    const err = await p.catch((e) => e)
    expect(err).not.toBeInstanceOf(TimeoutError)
    expect(err.name).toBe('AbortError')
  })

  it('signal da instância E da chamada: qualquer um cancela, com o próprio reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, opts) => pendingUntilAbort(opts.signal))
    )
    const perInstance = new AbortController()
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth: auth(),
      timeoutMs: 5000,
      signal: perInstance.signal,
    })
    const perCall = new AbortController()
    const p = client.get('/x/', {}, { signal: perCall.signal })
    perCall.abort(new Error('chamada cancelada'))
    await expect(p).rejects.toThrow('chamada cancelada')

    const q = client.get('/y/', {}, { signal: new AbortController().signal })
    perInstance.abort(new Error('desligando'))
    await expect(q).rejects.toThrow('desligando')
  })

  it('os dois signals já abortados: vale o reason do da instância, sem chamar o fetch', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const perInstance = new AbortController()
    perInstance.abort(new Error('instância'))
    const perCall = new AbortController()
    perCall.abort(new Error('chamada'))
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth: auth(),
      timeoutMs: 5000,
      signal: perInstance.signal,
    })
    await expect(client.get('/x/', {}, { signal: perCall.signal })).rejects.toThrow('instância')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('signal também cancela durante a espera entre tentativas', async () => {
    const ctl = new AbortController()
    const fetch = vi.fn(async () => {
      ctl.abort(new Error('parou'))
      throw new TypeError('fetch failed')
    })
    vi.stubGlobal('fetch', fetch)
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth: auth(),
      timeoutMs: 5000,
      retry: { attempts: 3, backoffMs: 1 },
    })
    await expect(client.get('/x/', {}, { signal: ctl.signal })).rejects.toThrow('parou')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('falha de rede vira NetworkError com url, tentativas e cause', async () => {
    const original = new TypeError('fetch failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(original))
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth: auth(),
      timeoutMs: 5000,
      retry: { attempts: 2, backoffMs: 1 },
    })
    const err = await client.get('/x/', { page: 2 }).catch((e) => e)
    expect(err).toBeInstanceOf(NetworkError)
    expect(err).toMatchObject({
      url: 'https://mb.test/x/?page=2',
      method: 'GET',
      attempts: 2,
      mayHaveSucceeded: false,
    })
    expect(err.cause).toBe(original)
  })

  it('NetworkError numa escrita marca mayHaveSucceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('socket hang up')))
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth: auth(), timeoutMs: 5000 })
    const err = await client.post('/entrada/', { a: 1 }).catch((e) => e)
    expect(err).toBeInstanceOf(NetworkError)
    expect(err).toMatchObject({ method: 'POST', attempts: 1, mayHaveSucceeded: true })
  })
})

describe('HttpClient: corpo da resposta', () => {
  const auth = () => new Auth('u@test.com', 'pass', { token: 'tok' })
  const rawRes = (status, text) => ({ status, text: async () => text })
  const client = () => new HttpClient({ baseUrl: 'https://mb.test', auth: auth(), timeoutMs: 5000 })

  it('204 devolve null (em qualquer método)', async () => {
    vi.stubGlobal('fetch', makeFetch(rawRes(204, '')))
    await expect(client().delete('/contato/1/')).resolves.toBeNull()
  })

  it('escrita 200 com corpo vazio devolve null; postRaw idem', async () => {
    vi.stubGlobal('fetch', makeFetch(rawRes(200, ''), rawRes(200, '')))
    const c = client()
    await expect(c.post('/entrada/', { a: 1 })).resolves.toBeNull()
    await expect(c.postRaw('/rota/', null)).resolves.toBeNull()
  })

  it('GET 200 sem corpo → InvalidResponseError', async () => {
    vi.stubGlobal('fetch', makeFetch(rawRes(200, '')))
    await expect(client().get('/x/')).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('HTML com 200 → InvalidResponseError com status, trecho do corpo e cause', async () => {
    const html = '<html>' + 'x'.repeat(500) + '</html>'
    vi.stubGlobal('fetch', makeFetch(rawRes(200, html), rawRes(200, html)))
    const c = client()
    const err = await c.get('/x/').catch((e) => e)
    expect(err).toBeInstanceOf(InvalidResponseError)
    expect(err.statusCode).toBe(200)
    expect(err.slug).toBe('/x/')
    expect(err.bodySnippet).toBe(html.slice(0, 200))
    expect(err.cause).toBeInstanceOf(SyntaxError)
    await expect(c.postRaw('/rota/', null)).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('5xx com corpo HTML → ServerError com o corpo', async () => {
    vi.stubGlobal('fetch', makeFetch(rawRes(502, '<html>Bad Gateway</html>')))
    const err = await client()
      .get('/x/')
      .catch((e) => e)
    expect(err).toBeInstanceOf(ServerError)
    expect(err.body).toBe('<html>Bad Gateway</html>')
  })

  it.each([
    ['array', '[{"id":1}]', [{ id: 1 }]],
    ['número', '42', 42],
    ['null', 'null', null],
  ])('JSON %s no corpo é devolvido como veio', async (_kind, text, expected) => {
    vi.stubGlobal('fetch', makeFetch(rawRes(200, text)))
    await expect(client().get('/x/')).resolves.toEqual(expected)
  })

  it('objeto com detail E outras chaves é dado legítimo, não limite de requisições', async () => {
    const body = { detail: 'Lote 12', id: 7 }
    vi.stubGlobal('fetch', makeFetch(makeRes(200, body), makeRes(200, body)))
    const c = client()
    await expect(c.get('/lote/7/')).resolves.toEqual(body)
    await expect(c.postRaw('/rota/', null)).resolves.toEqual(body)
  })

  it('RateLimitError e InvalidPageError trazem a página do GET', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch(makeRes(200, { detail: 'throttled' }), makeRes(200, { detail: 'Página inválida.' }))
    )
    const c = client()
    expect(await c.get('/v/', { page: 7 }).catch((e) => e)).toMatchObject({
      name: 'RateLimitError',
      page: 7,
    })
    expect(await c.get('/v/', { page: 9 }).catch((e) => e)).toMatchObject({
      name: 'InvalidPageError',
      page: 9,
    })
  })
})

describe('HttpClient: validação das opções', () => {
  const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
  it.each([
    [{ timeoutMs: 0 }, 'timeoutMs'],
    [{ timeoutMs: -5 }, 'timeoutMs'],
    [{ timeoutMs: Number.NaN }, 'timeoutMs'],
    [{ retry: { attempts: 0 } }, 'retry.attempts'],
    [{ retry: { attempts: 1.5 } }, 'retry.attempts'],
    [{ retry: { backoffMs: -1 } }, 'retry.backoffMs'],
    [{ retry: { backoffMs: Infinity } }, 'retry.backoffMs'],
  ])('%o → ValidationError em %s', (opts, field) => {
    let err
    try {
      new HttpClient({ baseUrl: 'https://mb.test', auth, ...opts })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.field).toBe(field)
  })

  it('aceita os padrões e valores válidos', () => {
    expect(() => new HttpClient({ baseUrl: 'https://mb.test', auth })).not.toThrow()
    expect(
      () =>
        new HttpClient({
          baseUrl: 'https://mb.test',
          auth,
          timeoutMs: 1,
          retry: { attempts: 5, backoffMs: 0 },
        })
    ).not.toThrow()
  })
})

describe('HttpClient.postRaw repete uma única vez (sem loop infinito)', () => {
  it('se o relogin também retorna 401, lança AuthError sem loop', async () => {
    const fetch = makeFetch(
      makeRes(401, {}), // 1ª tentativa: expirado
      makeRes(401, {}) // login: credencial inválida
    )
    vi.stubGlobal('fetch', fetch)

    const auth = new Auth('u@test.com', 'pass', { token: 'old-tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })

    await expect(client.postRaw('/usuario/1/selecione-propriedade/', null)).rejects.toBeInstanceOf(
      AuthError
    )
    // 2 chamadas: original + tentativa de login. Não mais.
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('Revisão: relogin pendente e espera cancelável', () => {
  it('401 com token já trocado ESPERA o relogin terminar a reseleção antes de repetir', async () => {
    const order = []
    let releaseReselect
    let releaseB401
    const auth = new Auth('u@test.com', 'pass', {
      token: 'tok-old',
      properties: [{ id: 5, nome: 'F' }],
    })
    const fetch = vi.fn(async (url, opts) => {
      if (url.endsWith('/login-integracao/')) {
        return makeRes(200, { token: 'tok-new', propriedades: [{ propriedade_id: 5, nome: 'F' }] })
      }
      if (url.includes('/selecione-propriedade/')) {
        if (opts.headers.Authorization === 'JWT tok-new') {
          await new Promise((r) => (releaseReselect = r))
          order.push('reselect')
        }
        return makeRes(200, {})
      }
      if (opts.headers.Authorization === 'JWT tok-old') {
        // o 401 do b fica preso até o login já ter trocado o token
        if (url.endsWith('/b/')) await new Promise((r) => (releaseB401 = r))
        return makeRes(401, {})
      }
      order.push(`get${url.slice(-3)}`)
      return makeRes(200, { ok: true })
    })
    vi.stubGlobal('fetch', fetch)
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })
    await auth.selectProperty(client, 5)

    const b = client.get('/b/') // sai com tok-old
    await vi.waitFor(() => expect(releaseB401).toBeTypeOf('function'))
    const a = client.get('/a/') // 401 → relogin → token novo; reseleção presa
    await vi.waitFor(() => expect(releaseReselect).toBeTypeOf('function'))
    expect(auth.getToken()).toBe('tok-new')
    releaseB401() // b recebe 401 com o token JÁ trocado
    await new Promise((r) => setTimeout(r, 20))
    expect(order).toEqual([]) // b não repetiu antes da reseleção terminar
    releaseReselect()
    await Promise.all([a, b])
    expect(order[0]).toBe('reselect')
    expect(order.slice(1).sort()).toEqual(['get/a/', 'get/b/'])
    expect(fetch.mock.calls.filter(([u]) => u.endsWith('/login-integracao/'))).toHaveLength(1)
  })

  it('signal abortado durante a espera entre tentativas interrompe na hora', async () => {
    const ctl = new AbortController()
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetch)
    const client = new HttpClient({
      baseUrl: 'https://mb.test',
      auth: new Auth('u@test.com', 'pass', { token: 'tok' }),
      timeoutMs: 5000,
      retry: { attempts: 3, backoffMs: 60_000 },
    })
    const p = client.get('/x/', {}, { signal: ctl.signal })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    ctl.abort(new Error('desligando'))
    await expect(p).rejects.toThrow('desligando')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
