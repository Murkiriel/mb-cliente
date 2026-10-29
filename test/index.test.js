// Teste de integração leve do ponto de entrada (index.js): confirma que
// MultBovinos monta BiApi/ErpApi corretamente com todos os sub-módulos
// (o mesmo tipo de erro de ligação já apareceu na prática — EstoqueErp
// recebia um `client` que nunca usava — e não é pego por testes unitários
// que simulam cada módulo isoladamente).
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as sdk from '../index.js'
import { MultBovinos } from '../index.js'

function makeRes(status, data) {
  return { status, json: async () => data, text: async () => JSON.stringify(data) }
}

function makeFetch(responses) {
  let i = 0
  return vi.fn().mockImplementation(() => Promise.resolve(responses[i++] ?? responses.at(-1)))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exports da raiz', () => {
  // 1.2.0 (BREAKING): a função crua exige os objetos internos auth/client —
  // o caminho público é o método mb.forAllProperties().
  it('não reexporta o helper interno forAllProperties', () => {
    expect(sdk).not.toHaveProperty('forAllProperties')
    expect(typeof MultBovinos.prototype.forAllProperties).toBe('function')
  })

  it('mantém os helpers públicos', () => {
    for (const name of [
      'safeImport',
      'getWeeklyWindows',
      'getMonthlyWindows',
      'lastDayOfMonth',
      'firstDayOfMonth',
      'collectPages',
      'paginate',
    ]) {
      expect(typeof sdk[name]).toBe('function')
    }
  })
})

describe('MultBovinos — construtor', () => {
  it('lança erro para env desconhecido', () => {
    expect(() => new MultBovinos({ email: 'u@test.com', password: 'p', env: 'staging' })).toThrow(
      /Ambiente desconhecido/
    )
  })
})

describe('MultBovinos — ligação de ponta a ponta', () => {
  it('connect() autentica e selectProperty() seleciona a fazenda', async () => {
    const fetch = makeFetch([
      makeRes(200, {
        token: 'tok1',
        fazendas: [{ id: 100, nome: 'Fazenda A', cnpj: null }],
      }),
      makeRes(200, { dados: true }),
    ])
    vi.stubGlobal('fetch', fetch)

    const mb = new MultBovinos({ email: 'u@test.com', password: 'pass', timeoutMs: 5000 })
    const { token, properties } = await mb.connect()

    expect(token).toBe('tok1')
    expect(properties).toEqual([{ id: 100, nome: 'Fazenda A', cnpj: null }])
    expect(mb.getToken()).toBe('tok1')
    expect(mb.getProperties()).toEqual(properties)

    await mb.selectProperty(100)
    expect(fetch.mock.calls[1][0]).toContain('/usuario/100/selecione-propriedade/')
  })

  it('mb.bi.* chega até o HttpClient real (envelope { dados })', async () => {
    const fetch = makeFetch([
      makeRes(200, { token: 'tok1', fazendas: [{ id: 1, nome: 'F1', cnpj: null }] }),
      makeRes(200, { dados: [{ material_id: 1 }] }),
    ])
    vi.stubGlobal('fetch', fetch)

    const mb = new MultBovinos({ email: 'u@test.com', password: 'pass' })
    await mb.connect()
    const { items } = await mb.bi.materiais.get()

    expect(items).toHaveLength(1)
    expect(fetch.mock.calls[1][0]).toContain('/integracaobi/obtenha-cadastros-materiais')
  })

  it('mb.erp.* chega até o grid ERP real (envelope paginado)', async () => {
    const fetch = makeFetch([
      makeRes(200, { token: 'tok1', fazendas: [{ id: 1, nome: 'F1', cnpj: null }] }),
      makeRes(200, { count: 1, results: [{ id: 1, nome: 'Ração X' }], links: {} }),
    ])
    vi.stubGlobal('fetch', fetch)

    const mb = new MultBovinos({ email: 'u@test.com', password: 'pass' })
    await mb.connect()
    const { items, count } = await mb.erp.cadastros.getRacoes({ page: 1 })

    expect(count).toBe(1)
    expect(items[0].nome).toBe('Ração X')
  })

  it('todos os 9 sub-módulos ERP estão presentes e utilizáveis (regressão de ligação)', async () => {
    const fetch = makeFetch([
      makeRes(200, { token: 'tok1', fazendas: [{ id: 1, nome: 'F1', cnpj: null }] }),
      makeRes(200, { count: 1, results: [{ id: 1 }], links: {} }),
    ])
    vi.stubGlobal('fetch', fetch)

    const mb = new MultBovinos({ email: 'u@test.com', password: 'pass' })
    await mb.connect()

    for (const mod of [
      'cadastros',
      'animais',
      'sanitario',
      'estoque',
      'custos',
      'auditoria',
      'financeiro',
      'reproducao',
      'outros',
    ]) {
      expect(mb.erp[mod]).toBeDefined()
    }
    // getTratos() é o método que expôs o bug de constructor duplicado em EstoqueErp
    await expect(
      mb.erp.estoque.getTratos({ from: '2026-01-01', to: '2026-01-02', maxPages: 1, propertyId: 1 })
    ).resolves.toBeDefined()
  })

  it('forAllProperties() percorre as fazendas sequencialmente via mb', async () => {
    const fetch = makeFetch([
      makeRes(200, {
        token: 'tok1',
        fazendas: [
          { id: 1, nome: 'F1', cnpj: null },
          { id: 2, nome: 'F2', cnpj: null },
        ],
      }),
      makeRes(200, { dados: true }), // selecione-propriedade F1
      makeRes(200, { dados: true }), // selecione-propriedade F2
    ])
    vi.stubGlobal('fetch', fetch)

    const mb = new MultBovinos({ email: 'u@test.com', password: 'pass' })
    await mb.connect()

    const result = await mb.forAllProperties(async (id) => [{ id }])
    expect(result).toHaveLength(2)
    expect(result[0]._propertyId).toBe(1)
    expect(result[1]._propertyId).toBe(2)
  })
})
