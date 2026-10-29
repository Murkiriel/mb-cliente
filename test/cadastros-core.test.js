// Cobertura dos métodos do núcleo de CadastrosErp/AnimaisErp/SanitarioErp/
// EstoqueErp — os que vêm dos dois manuais oficiais (os endpoints adicionais
// já são cobertos em descobertos.test.js, endpoints-adicionais.test.js e erp.test.js).
import { describe, it, expect, vi } from 'vitest'
import { ErpGrid } from '../src/erp/grid.js'
import { CadastrosErp } from '../src/erp/cadastros.js'
import { AnimaisErp } from '../src/erp/animais.js'
import { SanitarioErp } from '../src/erp/sanitario.js'
import { EstoqueErp } from '../src/erp/estoque.js'

function fakeGridClient() {
  return {
    get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }),
    post: vi.fn().mockResolvedValue({ id: 1 }),
    put: vi.fn().mockResolvedValue({ id: 1 }),
    patch: vi.fn().mockResolvedValue({ id: 1 }),
  }
}

describe('CadastrosErp — leitura do núcleo (manuais oficiais)', () => {
  const cases = [
    ['getContatos', '/contato/'],
    ['getGruposMaterial', '/grupomaterial/'],
    ['getSubgruposMaterial', '/subgrupomaterial/'],
    ['getUnidadesMedidas', '/unidadesmedidas/'],
    ['getMateriais', '/materiais/'],
    ['getContas', '/conta/'],
    ['getGruposContas', '/grupoconta/'],
    ['getFormasPagamento', '/formapagamento/'],
    ['getLotesAlimentares', '/lotealimentar/'],
    ['getLotesFinalidade', '/lotefinalidade/'],
    ['getRacas', '/raca/'],
    ['getPelagens', '/pelagem/'],
    ['getPropriedades', '/propriedade/'],
    ['getRebanhos', '/rebanho/'],
    ['getCidades', '/cidade/'],
    ['getEstados', '/estado/'],
    ['getPaises', '/pais/'],
  ]
  for (const [method, path] of cases) {
    it(`${method} delega para ${path}`, async () => {
      const client = fakeGridClient()
      const cadastros = new CadastrosErp(new ErpGrid(client))
      await cadastros[method]({ page: 1 })
      expect(client.get).toHaveBeenCalledWith(path, expect.objectContaining({ page: 1 }))
    })
  }
})

describe('CadastrosErp — escrita do núcleo (create/update/patch)', () => {
  it('createContato faz POST em /contato/ com o body', async () => {
    const client = fakeGridClient()
    const cadastros = new CadastrosErp(new ErpGrid(client))
    const body = { nome: 'Fornecedor X', tipo_pessoa: 'PJ', categoria: 1, ativo: true }
    await cadastros.createContato(body)
    expect(client.post).toHaveBeenCalledWith('/contato/', body)
  })

  it('updateContato faz PATCH em /contato/:id/ com o body parcial', async () => {
    const client = fakeGridClient()
    const cadastros = new CadastrosErp(new ErpGrid(client))
    await cadastros.updateContato(7, { ativo: false })
    expect(client.patch).toHaveBeenCalledWith('/contato/7/', { ativo: false })
  })

  it('createGrupoMaterial faz POST em /grupomaterial/', async () => {
    const client = fakeGridClient()
    const cadastros = new CadastrosErp(new ErpGrid(client))
    await cadastros.createGrupoMaterial({ nome: 'Grupo X' })
    expect(client.post).toHaveBeenCalledWith('/grupomaterial/', { nome: 'Grupo X' })
  })

  it('createSubgrupoMaterial faz POST em /subgrupomaterial/', async () => {
    const client = fakeGridClient()
    const cadastros = new CadastrosErp(new ErpGrid(client))
    await cadastros.createSubgrupoMaterial({ nome: 'Subgrupo X', grupo_material: 1 })
    expect(client.post).toHaveBeenCalledWith('/subgrupomaterial/', {
      nome: 'Subgrupo X',
      grupo_material: 1,
    })
  })

  it('createUnidadeMedida faz POST em /unidadesmedidas/', async () => {
    const client = fakeGridClient()
    const cadastros = new CadastrosErp(new ErpGrid(client))
    await cadastros.createUnidadeMedida({ nome: 'Quilograma', tipo_unidade: 2 })
    expect(client.post).toHaveBeenCalledWith('/unidadesmedidas/', {
      nome: 'Quilograma',
      tipo_unidade: 2,
    })
  })

  it('createMaterial faz POST em /materiais/', async () => {
    const client = fakeGridClient()
    const cadastros = new CadastrosErp(new ErpGrid(client))
    const body = { nome: 'Sal mineral', grupo_material: 1, codigo_erp: 'X1', ativo: true }
    await cadastros.createMaterial(body)
    expect(client.post).toHaveBeenCalledWith('/materiais/', body)
  })

  it('updateMaterial faz PUT em /materiais/:id/', async () => {
    const client = fakeGridClient()
    const cadastros = new CadastrosErp(new ErpGrid(client))
    await cadastros.updateMaterial(9, { nome: 'Sal mineral 2.0' })
    expect(client.put).toHaveBeenCalledWith('/materiais/9/', { nome: 'Sal mineral 2.0' })
  })
})

describe('AnimaisErp — núcleo (manuais oficiais)', () => {
  it('getSaidas delega para /saida/', async () => {
    const client = fakeGridClient()
    const animais = new AnimaisErp(new ErpGrid(client), { post: vi.fn(), put: vi.fn() })
    await animais.getSaidas({ page: 1 })
    expect(client.get).toHaveBeenCalledWith('/saida/', expect.objectContaining({ page: 1 }))
  })

  it('getVendas delega para /venda/', async () => {
    const client = fakeGridClient()
    const animais = new AnimaisErp(new ErpGrid(client), { post: vi.fn(), put: vi.fn() })
    await animais.getVendas({ page: 1 })
    expect(client.get).toHaveBeenCalledWith('/venda/', expect.objectContaining({ page: 1 }))
  })

  it('getMortes delega para /morte/', async () => {
    const client = fakeGridClient()
    const animais = new AnimaisErp(new ErpGrid(client), { post: vi.fn(), put: vi.fn() })
    await animais.getMortes({ page: 1 })
    expect(client.get).toHaveBeenCalledWith('/morte/', expect.objectContaining({ page: 1 }))
  })

  it('findByOrdemServico faz POST em /entrada/obtenha/ com a ordem de serviço', async () => {
    const post = vi.fn().mockResolvedValue({ id: 42 })
    const animais = new AnimaisErp(new ErpGrid({ get: vi.fn() }), { post, put: vi.fn() })
    const result = await animais.findByOrdemServico('OS-123')
    expect(post).toHaveBeenCalledWith('/entrada/obtenha/', { ordem_servico: 'OS-123' })
    expect(result).toEqual({ id: 42 })
  })

  it('updateEntradaFinanceiro faz PUT em /entrada/:id/ com o body financeiro', async () => {
    const put = vi.fn().mockResolvedValue({ id: 42, atualizado: true })
    const animais = new AnimaisErp(new ErpGrid({ get: vi.fn() }), { post: vi.fn(), put })
    const body = { data_aquisicao: '2026-06-01', valor_compra: 50000 }
    const result = await animais.updateEntradaFinanceiro(42, body)
    expect(put).toHaveBeenCalledWith('/entrada/42/', body)
    expect(result).toEqual({ id: 42, atualizado: true })
  })
})

describe('SanitarioErp — núcleo (manuais oficiais)', () => {
  it('getVacinacoes usa fetchAll (paginação completa) sobre /vacinacao/', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }),
    }
    const sanitario = new SanitarioErp(new ErpGrid(client))
    const summary = await sanitario.getVacinacoes({ delayMs: 0, maxPages: 1 })
    expect(client.get).toHaveBeenCalledWith('/vacinacao/', expect.objectContaining({ page: 1 }))
    expect(summary.pagesRead).toBe(1)
  })

  it('getTratamentos usa fetchAll sobre /tratamentoanimal/', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }),
    }
    const sanitario = new SanitarioErp(new ErpGrid(client))
    await sanitario.getTratamentos({ delayMs: 0, maxPages: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/tratamentoanimal/',
      expect.objectContaining({ page: 1 })
    )
  })

  const classicEvents = [
    ['getProtocolos', '/protocolo/'],
    ['getOcorrencias', '/ocorrencia/'],
    ['getSemens', '/semen/'],
    ['getEmbrioes', '/embriao/'],
    ['getCoberturas', '/cobertura/'],
    ['getPartos', '/parto/'],
  ]
  for (const [method, path] of classicEvents) {
    it(`${method} delega para ${path} (allowEmpty implícito)`, async () => {
      const client = fakeGridClient()
      const sanitario = new SanitarioErp(new ErpGrid(client))
      await sanitario[method]({ page: 1 })
      expect(client.get).toHaveBeenCalledWith(path, expect.objectContaining({ page: 1 }))
    })
  }
})

describe('EstoqueErp — núcleo (manuais oficiais)', () => {
  it('getEntradaMaterial delega para /entradamaterial/', async () => {
    const client = fakeGridClient()
    const estoque = new EstoqueErp(new ErpGrid(client))
    await estoque.getEntradaMaterial({ page: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/entradamaterial/',
      expect.objectContaining({ page: 1 })
    )
  })

  it('createEntradaMaterial faz POST em /entradamaterial/ com o body', async () => {
    const client = fakeGridClient()
    const estoque = new EstoqueErp(new ErpGrid(client))
    const body = {
      propriedade: 1,
      data: '2026-06-01',
      forma_pagamento: 1,
      contato: 5,
      responsavel: 2,
      itens: [{ produto: 10, quantidade: 3, valor_unitario: 100 }],
    }
    await estoque.createEntradaMaterial(body)
    expect(client.post).toHaveBeenCalledWith('/entradamaterial/', body)
  })

  it('getGtas delega para /gta/', async () => {
    const client = fakeGridClient()
    const estoque = new EstoqueErp(new ErpGrid(client))
    await estoque.getGtas({ page: 1 })
    expect(client.get).toHaveBeenCalledWith('/gta/', expect.objectContaining({ page: 1 }))
  })
})
