// Sessão, prazos e erros: mb.relogin(), timeoutMs por chamada no BI e nos
// custos, NotFoundError para 404 e parseBrDateTime.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MultBovinos } from '../index.js'
import { Auth } from '../src/auth.js'
import { HttpClient } from '../src/client.js'
import { CustosErp } from '../src/erp/custos.js'
import { FazendasBi } from '../src/bi/fazendas.js'
import { SuplementacaoBi } from '../src/bi/suplementacao.js'
import { ClientError, NotFoundError, ValidationError, errors } from '../index.js'
import { parseBrDateTime } from '../src/parsers.js'

afterEach(() => vi.unstubAllGlobals())

const res = (status, data) => ({ status, text: async () => JSON.stringify(data) })

describe('mb.relogin()', () => {
  it('faz login de novo e reseleciona a fazenda, sem contar como troca', async () => {
    const fetch = vi.fn(async (url) => {
      if (url.includes('login-integracao')) return res(200, { token: 't2', fazendas: [{ id: 7 }] })
      return res(200, {})
    })
    vi.stubGlobal('fetch', fetch)
    const mb = new MultBovinos({
      email: 'a@b.c',
      password: 'x',
      token: 't1',
      properties: [{ id: 7, nome: 'A' }],
    })
    await mb.selectProperty(7)
    const before = fetch.mock.calls.length
    const out = await mb.relogin()
    expect(out.token).toBe('t2')
    expect(mb.getToken()).toBe('t2')
    const urls = fetch.mock.calls.slice(before).map(([u]) => u)
    expect(urls[0]).toMatch(/login-integracao/)
    expect(urls[1]).toMatch(/usuario\/7\/selecione-propriedade/)
  })
})

describe('NotFoundError', () => {
  it('HTTP 404 vira NotFoundError (subclasse de ClientError); 403 continua ClientError', async () => {
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    const client = new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 5000 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res(404, { detail: 'Não encontrado.' }))
    )
    const err = await client.get('/confinamento/1/').catch((e) => e)
    expect(err).toBeInstanceOf(NotFoundError)
    expect(err).toBeInstanceOf(ClientError)
    expect(err.statusCode).toBe(404)
    expect(errors.NotFoundError).toBe(NotFoundError)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res(403, { detail: 'Proibido.' }))
    )
    const forbidden = await client.get('/x/').catch((e) => e)
    expect(forbidden).toBeInstanceOf(ClientError)
    expect(forbidden).not.toBeInstanceOf(NotFoundError)
  })
})

describe('timeoutMs por chamada — BI', () => {
  it('sem timeoutMs: chamada como antes; com timeoutMs: vai para o cliente HTTP', async () => {
    const client = { get: vi.fn().mockResolvedValue({ dados: [{ id: 1 }] }) }
    await new FazendasBi(client).get()
    expect(client.get).toHaveBeenLastCalledWith('/integracaobi/obtenha-cadastros-fazendas')
    await new FazendasBi(client).get({ timeoutMs: 1234 })
    expect(client.get).toHaveBeenLastCalledWith(
      '/integracaobi/obtenha-cadastros-fazendas',
      {},
      { timeoutMs: 1234 }
    )
  })

  it('endpoint por fazenda com janela: a query vai junto do prazo', async () => {
    const client = { get: vi.fn().mockResolvedValue({ dados: [] }) }
    const auth = { inProperty: vi.fn((_c, _p, _e, fn) => fn()) }
    await new SuplementacaoBi(client, auth).get({
      from: '2026-10-01',
      to: '2026-10-07',
      propertyId: 1,
      timeoutMs: 99,
    })
    expect(client.get).toHaveBeenCalledWith(
      '/integracaobi/obtenha-suplementacao-animal',
      { data_inicio: '2026-10-01', data_fim: '2026-10-07' },
      { timeoutMs: 99 }
    )
  })
})

describe('timeoutMs por chamada — custos', () => {
  const auth = { inProperty: vi.fn((_c, _p, _e, fn) => fn()) }

  it('padrão de 300 s; timeoutMs da chamada troca', async () => {
    const client = { post: vi.fn().mockResolvedValue({ dados: [] }) }
    const custos = new CustosErp(client, auth)
    await custos.getSaldoBiologico({ referenceDate: '2026-06-01' })
    expect(client.post.mock.calls[0][2]).toEqual({ timeoutMs: 300_000 })
    await custos.getSaldoBiologico({ referenceDate: '2026-06-01', timeoutMs: 10_000 })
    expect(client.post.mock.calls[1][2]).toEqual({ timeoutMs: 10_000 })
  })

  it('timeoutMs inválido → ValidationError antes da chamada', async () => {
    const client = { post: vi.fn() }
    await expect(
      new CustosErp(client, auth).getSaldoBiologico({ referenceDate: '2026-06-01', timeoutMs: 0 })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(client.post).not.toHaveBeenCalled()
  })
})

describe('parseBrDateTime', () => {
  it.each([
    ['08/03/2026 14:05', '2026-03-08 14:05'],
    ['08/03/2026 14:05:09', '2026-03-08 14:05:09'],
    ['08/03/2026  07:00', '2026-03-08 07:00'],
    ['31/02/2026 10:00', '31/02/2026 10:00'],
    ['08/03/2026 24:00', '08/03/2026 24:00'],
    ['08/03/2026 10:60', '08/03/2026 10:60'],
    ['08/03/2026 10:00:60', '08/03/2026 10:00:60'],
    ['08/03/2026', '08/03/2026'],
    ['2026-03-08 14:05', '2026-03-08 14:05'],
    [null, null],
    [42, 42],
  ])('%s → %s', (input, expected) => {
    expect(parseBrDateTime(input)).toBe(expected)
  })
})

describe('prazos padrão que não encurtam a instância', () => {
  it('custos e recálculo usam o maior entre o padrão e o timeoutMs da instância', async () => {
    const client = { timeoutMs: 1_200_000, post: vi.fn().mockResolvedValue({ dados: [] }) }
    const auth = {
      inProperty: vi.fn((_c, _p, _e, fn) => fn()),
      withProperty: vi.fn((_c, _p, fn) => fn()),
    }
    await new CustosErp(client, auth).getSaldoBiologico({ referenceDate: '2026-06-01' })
    expect(client.post.mock.calls[0][2]).toEqual({ timeoutMs: 1_200_000 })
    const { EstoqueErp } = await import('../src/erp/estoque.js')
    const { ErpGrid } = await import('../src/erp/grid.js')
    await new EstoqueErp(new ErpGrid(client), client, auth).reprocessRelatorioGestaoNutricionalLote(
      {
        propertyId: 1,
        date: '2026-07-20',
        loteConfinamento: 2,
        linhaConfinamento: 3,
      }
    )
    expect(client.post.mock.calls[1][2]).toEqual({ timeoutMs: 1_200_000 })
  })

  it('HttpClient expõe o prazo da instância', () => {
    const auth = new Auth('u@test.com', 'pass', { token: 'tok' })
    expect(new HttpClient({ baseUrl: 'https://mb.test', auth, timeoutMs: 1234 }).timeoutMs).toBe(
      1234
    )
  })
})
