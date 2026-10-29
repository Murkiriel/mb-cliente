import { describe, it, expect, vi } from 'vitest'
import { BiApi } from '../src/bi/index.js'
import { FazendasBi } from '../src/bi/fazendas.js'
import { SuplementacaoBi } from '../src/bi/suplementacao.js'
import { ProducaoRacaoBi } from '../src/bi/producaoRacao.js'
import { MovEstoqueBi } from '../src/bi/movEstoque.js'
import { DietaBi } from '../src/bi/dieta.js'
import { FornecedoresBi } from '../src/bi/fornecedores.js'
import { LocalidadesBi } from '../src/bi/localidades.js'
import { MateriaisBi } from '../src/bi/materiais.js'
import { forAllProperties } from '../src/helpers/allProperties.js'
import { ValidationError } from '../src/errors.js'

function makeClient(responseMap = {}) {
  return {
    get: vi.fn().mockImplementation((path) => {
      const key = Object.keys(responseMap).find((k) => path.includes(k))
      if (key) return Promise.resolve(responseMap[key])
      return Promise.resolve({ dados: [] })
    }),
  }
}

// Auth falso mínimo: a seção exclusiva só delega (a fila real é testada
// em propertyLock.test.js e nos testes com o Auth real). Começa com uma
// fazenda selecionada, como depois de um selectProperty().
function makeAuth(properties = [{ id: 1 }, { id: 2 }]) {
  const auth = {
    getProperties: () => properties,
    selectProperty: vi.fn().mockResolvedValue(undefined),
    withProperty: async (client, id, fn) => {
      await auth.selectProperty(client, id)
      return fn()
    },
    inProperty: async (client, id, _endpoint, fn) =>
      id == null ? fn() : auth.withProperty(client, id, fn),
  }
  return auth
}

describe('BiApi.fazendas', () => {
  it('normaliza { dados: [...] } → { items, count }', async () => {
    const client = makeClient({
      'obtenha-cadastros-fazendas': { dados: [{ propriedade_id: 1 }, { propriedade_id: 2 }] },
    })
    const bi = new BiApi(client, makeAuth())
    const result = await bi.fazendas.get()
    expect(result.items).toHaveLength(2)
    expect(result.count).toBe(2)
  })

  it('retorna vazio quando dados é []', async () => {
    const client = makeClient({ 'obtenha-cadastros-fazendas': { dados: [] } })
    const bi = new BiApi(client, makeAuth())
    const result = await bi.fazendas.get()
    expect(result.items).toHaveLength(0)
  })
})

describe('BiApi.animais.getAll', () => {
  it('percorre propriedades sequencialmente e adiciona _propertyId', async () => {
    const client = makeClient({ 'obtenha-cadastros-gados-sisbov': { dados: [{ id: 'A' }] } })
    const auth = makeAuth([{ id: 10 }, { id: 20 }])
    const bi = new BiApi(client, auth)

    const result = await bi.animais.getAll()

    expect(auth.selectProperty).toHaveBeenCalledTimes(2)
    expect(auth.selectProperty).toHaveBeenNthCalledWith(1, client, 10)
    expect(auth.selectProperty).toHaveBeenNthCalledWith(2, client, 20)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]._propertyId).toBe(10)
    expect(result.items[1]._propertyId).toBe(20)
    expect(result.byProperty.get(10)).toHaveLength(1)
  })

  it('byProperty segue a ordem dos ids (inclusive fazenda vazia) e reusa os objetos de items', async () => {
    let calls = 0
    const client = {
      get: vi.fn(async () =>
        ++calls === 2 ? { dados: [] } : { dados: [{ id: `A${calls}` }, { id: `B${calls}` }] }
      ),
    }
    const bi = new BiApi(client, makeAuth())
    const result = await bi.animais.getAll([30, 10, 20])
    expect([...result.byProperty.keys()]).toEqual([30, 10, 20])
    expect(result.byProperty.get(10)).toEqual([])
    expect(result.byProperty.get(20)).toEqual([
      { id: 'A3', _propertyId: 20 },
      { id: 'B3', _propertyId: 20 },
    ])
    expect(result.items.map((i) => i.id)).toEqual(['A1', 'B1', 'A3', 'B3'])
    expect(result.byProperty.get(30)[0]).toBe(result.items[0])
    expect(result.count).toBe(4)
  })
})

describe('BiApi.movMateriais validação de janela', () => {
  it('lança ValidationError se from/to ausentes', async () => {
    const bi = new BiApi(makeClient(), makeAuth())
    await expect(bi.movMateriais.get({})).rejects.toBeInstanceOf(ValidationError)
  })

  it('lança ValidationError se janela > 31 dias corridos', async () => {
    const bi = new BiApi(makeClient(), makeAuth())
    await expect(
      bi.movMateriais.get({ from: '2026-01-01', to: '2026-02-01' }) // 32 dias
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('aceita janela de exatamente 31 dias (janeiro)', async () => {
    const client = makeClient({ 'obtenha-movimentacoes-materiais': { dados: [] } })
    const bi = new BiApi(client, makeAuth())
    await expect(
      bi.movMateriais.get({ from: '2026-01-01', to: '2026-01-31' })
    ).resolves.toBeDefined()
  })

  it('lança ValidationError se to for anterior a from (janela invertida)', async () => {
    const bi = new BiApi(makeClient(), makeAuth())
    await expect(
      bi.movMateriais.get({ from: '2026-06-10', to: '2026-06-01' })
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('BiApi.suplementacao', () => {
  it('aceita janela de mais de 31 dias (diferente de movMateriais)', async () => {
    const client = makeClient({ 'obtenha-suplementacao-animal': { dados: [{ pasto: 'P1' }] } })
    const supl = new SuplementacaoBi(client, makeAuth())
    await expect(
      supl.get({ from: '2023-01-01', to: '2024-01-31' }) // 396 dias — OK
    ).resolves.toMatchObject({ count: 1 })
  })

  it('lança ValidationError se from/to ausentes', async () => {
    const supl = new SuplementacaoBi({ get: vi.fn() }, makeAuth())
    await expect(supl.get({})).rejects.toBeInstanceOf(ValidationError)
  })
})

describe.each([
  ['DietaBi', DietaBi, 'obtenha-cadastros-dieta'],
  ['FornecedoresBi', FornecedoresBi, 'obtenha-cadastros-fornecedores'],
  ['LocalidadesBi', LocalidadesBi, 'obtenha-cadastros-localidades'],
  ['MateriaisBi', MateriaisBi, 'obtenha-cadastros-materiais'],
])('%s.get() — por contrato', (_name, Klass, slug) => {
  it('normaliza { dados: [...] } → { items, count }', async () => {
    const client = makeClient({ [slug]: { dados: [{ id: 1 }, { id: 2 }] } })
    const instance = new Klass(client)
    const result = await instance.get()
    expect(result.items).toHaveLength(2)
    expect(result.count).toBe(2)
    expect(client.get).toHaveBeenCalledWith(`/integracaobi/${slug}`)
  })

  it('retorna vazio quando dados é []', async () => {
    const client = makeClient({ [slug]: { dados: [] } })
    const instance = new Klass(client)
    const result = await instance.get()
    expect(result.items).toHaveLength(0)
  })
})

describe('Alternativa data.dados ?? [] quando a resposta não tem o campo dados', () => {
  const noDataClient = { get: vi.fn().mockResolvedValue({}) }

  it('FazendasBi.get()', async () => {
    const result = await new FazendasBi(noDataClient).get()
    expect(result).toEqual({ items: [], count: 0 })
  })

  it.each([
    ['DietaBi', DietaBi],
    ['FornecedoresBi', FornecedoresBi],
    ['LocalidadesBi', LocalidadesBi],
    ['MateriaisBi', MateriaisBi],
  ])('%s.get()', async (_name, Klass) => {
    const result = await new Klass(noDataClient).get()
    expect(result).toEqual({ items: [], count: 0 })
  })

  it('AnimaisBi.get()', async () => {
    const bi = new BiApi(noDataClient, makeAuth())
    const result = await bi.animais.get()
    expect(result).toEqual({ items: [], count: 0 })
  })

  it('MovEstoqueBi.get()', async () => {
    const bi = new MovEstoqueBi(noDataClient, makeAuth())
    const result = await bi.get()
    expect(result).toEqual({ items: [], count: 0 })
  })

  it('MovMateriaisBi.get() (com janela válida)', async () => {
    const bi = new BiApi(noDataClient, makeAuth())
    const result = await bi.movMateriais.get({ from: '2026-01-01', to: '2026-01-15' })
    expect(result).toEqual({ items: [], count: 0 })
  })

  it('SuplementacaoBi.get() (com janela válida)', async () => {
    const supl = new SuplementacaoBi(noDataClient, makeAuth())
    const result = await supl.get({ from: '2026-01-01', to: '2026-01-15' })
    expect(result).toEqual({ items: [], count: 0 })
  })

  it('ProducaoRacaoBi.get() e .getFormulacao()', async () => {
    const bi = new ProducaoRacaoBi(noDataClient, makeAuth())
    expect(await bi.get({ from: '2026-01-01', to: '2026-01-15' })).toEqual({
      items: [],
      count: 0,
    })
    expect(await bi.getFormulacao(1)).toEqual({ items: [], count: 0 })
  })
})

describe('MovEstoqueBi', () => {
  it('get() retorna a propriedade atualmente selecionada', async () => {
    const client = makeClient({ 'obtenha-movimentacoes-gados-estoque': { dados: [{ peso: 500 }] } })
    const bi = new MovEstoqueBi(client, makeAuth())
    const result = await bi.get()
    expect(result.items).toHaveLength(1)
  })

  it('getAll() percorre propriedades sequencialmente e adiciona _propertyId', async () => {
    const client = makeClient({ 'obtenha-movimentacoes-gados-estoque': { dados: [{ id: 'A' }] } })
    const auth = makeAuth([{ id: 10 }, { id: 20 }])
    const bi = new MovEstoqueBi(client, auth)

    const result = await bi.getAll()

    expect(auth.selectProperty).toHaveBeenCalledTimes(2)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]._propertyId).toBe(10)
    expect(result.items[1]._propertyId).toBe(20)
  })
})

describe('ProducaoRacaoBi', () => {
  it('get() exige from/to', async () => {
    const bi = new ProducaoRacaoBi({ get: vi.fn() }, makeAuth())
    await expect(bi.get({})).rejects.toBeInstanceOf(ValidationError)
  })

  it('get() retorna batidas de produção', async () => {
    const client = makeClient({ 'obtenha-producao-racao': { dados: [{ producao_id: 1 }] } })
    const bi = new ProducaoRacaoBi(client, makeAuth())
    const result = await bi.get({ from: '2026-01-01', to: '2026-01-31' })
    expect(result.items).toHaveLength(1)
  })

  it('getFormulacao() exige producaoId', async () => {
    const bi = new ProducaoRacaoBi({ get: vi.fn() }, makeAuth())
    await expect(bi.getFormulacao()).rejects.toBeInstanceOf(ValidationError)
  })

  it('getFormulacao() retorna os ingredientes de uma batida', async () => {
    const client = makeClient({
      'obtenha-producao-racao-formulacao': { dados: [{ ingrediente: 'Milho' }] },
    })
    const bi = new ProducaoRacaoBi(client, makeAuth())
    const result = await bi.getFormulacao(123)
    expect(result.items).toHaveLength(1)
    expect(client.get).toHaveBeenCalledWith(expect.stringContaining('producao-racao-formulacao'), {
      producao: 123,
    })
  })
})

describe('forAllProperties (helper cru)', () => {
  it('seleciona cada propriedade sequencialmente e marca _propertyId', async () => {
    const auth = makeAuth([{ id: 1 }, { id: 2 }, { id: 3 }])
    const client = {}
    const selectionOrder = []
    auth.selectProperty.mockImplementation(async (_client, id) => {
      selectionOrder.push(id)
    })

    const callback = vi.fn().mockImplementation(async (id) => [{ valor: id * 10 }])
    const result = await forAllProperties(auth, client, callback)

    expect(selectionOrder).toEqual([1, 2, 3]) // sequencial, na ordem
    expect(callback).toHaveBeenCalledTimes(3)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ valor: 10, _propertyId: 1 })
    expect(result[2]).toEqual({ valor: 30, _propertyId: 3 })
  })

  it('respeita propertyIds explícito em vez de todas as propriedades', async () => {
    const auth = makeAuth([{ id: 1 }, { id: 2 }, { id: 3 }])
    const callback = vi.fn().mockResolvedValue([])
    await forAllProperties(auth, {}, callback, [2])
    expect(auth.selectProperty).toHaveBeenCalledTimes(1)
    expect(auth.selectProperty).toHaveBeenCalledWith({}, 2)
  })
})

describe('BiApi — ligação de todas as propriedades de leitura', () => {
  it('bi.localidades/fornecedores/dieta/movEstoque/suplementacao/producaoRacao chegam à classe certa', () => {
    const bi = new BiApi(makeClient(), makeAuth())
    expect(bi.localidades).toBeInstanceOf(LocalidadesBi)
    expect(bi.fornecedores).toBeInstanceOf(FornecedoresBi)
    expect(bi.dieta).toBeInstanceOf(DietaBi)
    expect(bi.movEstoque).toBeInstanceOf(MovEstoqueBi)
    expect(bi.suplementacao).toBeInstanceOf(SuplementacaoBi)
    expect(bi.producaoRacao).toBeInstanceOf(ProducaoRacaoBi)
  })
})

describe('BiApi sem os endpoints inviáveis', () => {
  it('pesagem e movExtra não existem (não são expostos)', () => {
    const bi = new BiApi(makeClient(), makeAuth())
    expect('pesagem' in bi).toBe(false)
    expect('movExtra' in bi).toBe(false)
  })
})
