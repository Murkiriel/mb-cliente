// mb.raw (1.3.0): porta de baixo nível para endpoints sem método dedicado.
// Passa pelo MultBovinos real até o HttpClient real, com fetch simulado —
// confirma que raw herda autenticação, relogin e classificação de erros sem
// nenhum tratamento próprio (sem parse BR, sem espaçamento de chamadas).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MultBovinos } from '../index.js'
import {
  AuthError,
  ClientError,
  ServerError,
  RateLimitError,
  InvalidPageError,
  EmptyResponseError,
  ValidationError,
} from '../src/errors.js'

const BASE = 'https://www.multbovinos.com/servicos'
const LOGIN_OK = { token: 'tok1', fazendas: [{ id: 1, nome: 'F1', cnpj: null }] }

function makeRes(status, data) {
  return { status, json: async () => data, text: async () => JSON.stringify(data) }
}

function makeFetch(responses) {
  let i = 0
  return vi.fn().mockImplementation(() => Promise.resolve(responses[i++] ?? responses.at(-1)))
}

async function connected(responses) {
  const fetch = makeFetch([makeRes(200, LOGIN_OK), ...responses])
  vi.stubGlobal('fetch', fetch)
  const mb = new MultBovinos({ email: 'u@test.com', password: 'pass' })
  await mb.connect()
  return { mb, fetch }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mb.raw — ligação', () => {
  it('é sempre a mesma instância, com get e post', () => {
    const mb = new MultBovinos({ email: 'u@test.com', password: 'pass' })
    expect(mb.raw).toBe(mb.raw)
    expect(typeof mb.raw.get).toBe('function')
    expect(typeof mb.raw.post).toBe('function')
  })
})

describe('mb.raw — signal', () => {
  it('signal da chamada chega ao fetch em get e post', async () => {
    const { mb, fetch } = await connected([makeRes(200, { ok: 1 }), makeRes(200, { ok: 2 })])
    const ctl = new AbortController()
    await mb.raw.get('/x/', {}, { signal: ctl.signal })
    await mb.raw.post('/y/', {}, { signal: ctl.signal })
    ctl.abort()
    expect(fetch.mock.calls[1][1].signal.aborted).toBe(true)
    expect(fetch.mock.calls[2][1].signal.aborted).toBe(true)
  })

  it('signal da instância (new MultBovinos({ signal })) cancela as chamadas', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const ctl = new AbortController()
    const mb = new MultBovinos({
      email: 'u@test.com',
      password: 'pass',
      token: 'tok',
      signal: ctl.signal,
    })
    ctl.abort(new Error('encerrando'))
    await expect(mb.raw.get('/x/')).rejects.toThrow('encerrando')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('mb.raw.get', () => {
  it('monta a URL com params, omite null/undefined e devolve o JSON cru', async () => {
    const body = { count: 1, results: [{ valor: '1.234,56', data: '20/07/2026' }] }
    const { mb, fetch } = await connected([makeRes(200, body)])

    const data = await mb.raw.get('/producaopasto/', {
      page: 2,
      ativo: true,
      q: null,
      x: undefined,
    })

    // JSON cru: nada de parseBrNumber/parseBrDate
    expect(data).toEqual(body)
    const [url, opts] = fetch.mock.calls[1]
    expect(url).toBe(`${BASE}/producaopasto/?page=2&ativo=true`)
    expect(opts.method).toBe('GET')
    expect(opts.headers.Authorization).toBe('JWT tok1')
    expect(opts.headers.Dispositivo).toBe('8')
    expect(opts.body).toBeUndefined()
  })

  it('sem params chama a URL sem query string', async () => {
    const { mb, fetch } = await connected([makeRes(200, { dados: [] })])
    await expect(mb.raw.get('/integracaobi/x/')).resolves.toEqual({ dados: [] })
    expect(fetch.mock.calls[1][0]).toBe(`${BASE}/integracaobi/x/`)
  })

  it('faz relogin em 401 e repete a chamada', async () => {
    const { mb, fetch } = await connected([
      makeRes(401, { detail: 'expirado' }),
      makeRes(200, { token: 'tok2', fazendas: LOGIN_OK.fazendas }),
      makeRes(200, { ok: true }),
    ])
    await expect(mb.raw.get('/x/')).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(fetch.mock.calls[3][1].headers.Authorization).toBe('JWT tok2')
  })

  it('lança EmptyResponseError em {count:0, results:[]} (limite silencioso de requisições)', async () => {
    const { mb } = await connected([makeRes(200, { count: 0, results: [] })])
    await expect(mb.raw.get('/x/')).rejects.toBeInstanceOf(EmptyResponseError)
  })

  it('classifica { detail } com HTTP 200 como RateLimitError', async () => {
    const { mb } = await connected([makeRes(200, { detail: 'Request was throttled.' })])
    await expect(mb.raw.get('/x/')).rejects.toBeInstanceOf(RateLimitError)
  })

  it('classifica "Página inválida." como InvalidPageError', async () => {
    const { mb } = await connected([makeRes(200, { detail: 'Página inválida.' })])
    await expect(mb.raw.get('/x/', { page: 999 })).rejects.toBeInstanceOf(InvalidPageError)
  })

  it('HTTP 404 vira ClientError com statusCode e body', async () => {
    const { mb } = await connected([makeRes(404, { detail: 'Não encontrado.' })])
    const err = await mb.raw.get('/nao-existe/').catch((e) => e)
    expect(err).toBeInstanceOf(ClientError)
    expect(err.statusCode).toBe(404)
    expect(err.body).toContain('Não encontrado.')
  })

  it('HTTP 500 vira ServerError', async () => {
    const { mb } = await connected([makeRes(500, { erro: 'boom' })])
    await expect(mb.raw.get('/x/')).rejects.toBeInstanceOf(ServerError)
  })

  it('sem connect() lança AuthError antes de qualquer fetch', async () => {
    const fetch = makeFetch([makeRes(200, {})])
    vi.stubGlobal('fetch', fetch)
    const mb = new MultBovinos({ email: 'u@test.com', password: 'pass' })
    await expect(mb.raw.get('/x/')).rejects.toBeInstanceOf(AuthError)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('mb.raw.post', () => {
  it('envia o body em JSON e devolve o JSON cru', async () => {
    const resp = { dados: { localidades: [{ peso: '450,5' }] } }
    const { mb, fetch } = await connected([makeRes(200, resp)])
    const body = { propriedade: 1, data: '2026-07-20T03:00:00.000Z' }

    const data = await mb.raw.post('/producaopasto/relatorio-gestao-nutricional-lote/', body)

    // Sem desembrulhar `dados` nem parsear número BR
    expect(data).toEqual(resp)
    const [url, opts] = fetch.mock.calls[1]
    expect(url).toBe(`${BASE}/producaopasto/relatorio-gestao-nutricional-lote/`)
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.headers.Authorization).toBe('JWT tok1')
    expect(JSON.parse(opts.body)).toEqual(body)
  })

  it('sem body envia {}', async () => {
    const { mb, fetch } = await connected([makeRes(200, { ok: true })])
    await mb.raw.post('/x/')
    expect(fetch.mock.calls[1][1].body).toBe('{}')
  })

  it('não lança EmptyResponseError em POST (regra só vale para GET)', async () => {
    const { mb } = await connected([makeRes(200, { count: 0, results: [] })])
    await expect(mb.raw.post('/x/', {})).resolves.toEqual({ count: 0, results: [] })
  })

  it('faz relogin em 401 e repete o POST', async () => {
    const { mb, fetch } = await connected([
      makeRes(401, { detail: 'expirado' }),
      makeRes(200, { token: 'tok2', fazendas: LOGIN_OK.fazendas }),
      makeRes(200, { ok: true }),
    ])
    await expect(mb.raw.post('/x/', { a: 1 })).resolves.toEqual({ ok: true })
    expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({ a: 1 })
  })

  it('HTTP 400 vira ClientError e 503 vira ServerError', async () => {
    const { mb } = await connected([
      makeRes(400, { data: ['obrigatório'] }),
      makeRes(503, { erro: 'indisponível' }),
    ])
    await expect(mb.raw.post('/x/', {})).rejects.toBeInstanceOf(ClientError)
    await expect(mb.raw.post('/x/', {})).rejects.toBeInstanceOf(ServerError)
  })
})

describe('mb.raw — validação de path', () => {
  it.each([
    ['sem barra inicial', 'producaopasto/'],
    ['URL absoluta', 'https://exemplo.com/x/'],
    ['vazio', ''],
    ['não-string', 42],
    ['undefined', undefined],
  ])('recusa path %s com ValidationError, sem chamar fetch', async (_label, path) => {
    const { mb, fetch } = await connected([])
    const calls = fetch.mock.calls.length
    const errGet = await mb.raw.get(path).catch((e) => e)
    const errPost = await mb.raw.post(path, {}).catch((e) => e)
    for (const err of [errGet, errPost]) {
      expect(err).toBeInstanceOf(ValidationError)
      expect(err.field).toBe('path')
      expect(err.received).toBe(path)
    }
    expect(fetch.mock.calls.length).toBe(calls)
  })
})
