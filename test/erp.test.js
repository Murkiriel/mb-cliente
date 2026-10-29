import { describe, it, expect, vi } from 'vitest'
import { ErpGrid } from '../src/erp/grid.js'
import { safeImport } from '../src/helpers/safeImport.js'
import { paginate } from '../src/helpers/paginate.js'
import { SELECTION } from '../src/selectionMark.js'
import {
  RateLimitError,
  EmptyResponseError,
  EndpointUnavailableError,
  ValidationError,
  InvalidResponseError,
  PropertyNotSelectedError,
} from '../src/errors.js'
import { Auth } from '../src/auth.js'
import { EstoqueErp } from '../src/erp/estoque.js'
import { CadastrosErp } from '../src/erp/cadastros.js'
import { SanitarioErp } from '../src/erp/sanitario.js'
import { AuditoriaErp } from '../src/erp/auditoria.js'
import { AnimaisErp } from '../src/erp/animais.js'

function makeClient(responses = []) {
  let call = 0
  return {
    get: vi.fn().mockImplementation(() => {
      const r = responses[call] ?? responses[responses.length - 1]
      call++
      return Promise.resolve(r)
    }),
  }
}

describe('ErpGrid.fetchPage', () => {
  it('retorna items, count, hasMore', async () => {
    const client = makeClient([
      {
        count: 15,
        links: { next: '?page=2', previous: null },
        results: [{ id: 1, valor: '1.000,50', data: '01/01/2026' }],
      },
    ])
    const grid = new ErpGrid(client)
    const result = await grid.fetchPage('vacinacao', { page: 1 })

    expect(result.items).toHaveLength(1)
    expect(result.count).toBe(15)
    expect(result.hasMore).toBe(true)
    expect(result.nextPage).toBe(2)
  })

  // Sem a lista results, tratar como vazio faria a paginação parecer
  // terminada (ex.: uma limitação do servidor fora do formato { detail } puro).
  it.each([[{}], [{ detail: 'Request was throttled.', wait: 5 }], [null], [[1, 2]]])(
    'resposta sem a lista results → InvalidResponseError (%o)',
    async (body) => {
      const grid = new ErpGrid(makeClient([body]))
      const err = await grid.fetchPage('vacinacao', { page: 1 }).catch((x) => x)
      expect(err).toBeInstanceOf(InvalidResponseError)
      expect(err.slug).toBe('vacinacao')
    }
  )

  it('results presente sem count → count 0', async () => {
    const grid = new ErpGrid(makeClient([{ results: [] }]))
    expect(await grid.fetchPage('vacinacao', {})).toMatchObject({ items: [], count: 0 })
  })

  it('aplica BR parse automaticamente', async () => {
    const client = makeClient([
      {
        count: 1,
        links: { next: null },
        results: [{ valor: '2.500,75', data_evento: '15/06/2026' }],
      },
    ])
    const grid = new ErpGrid(client)
    const result = await grid.fetchPage('tratos', {})

    expect(result.items[0].valor).toBe(2500.75)
    expect(result.items[0].data_evento).toBe('2026-06-15')
  })

  it('page nomeado nunca é sobrescrito por extraParams.page acidental', async () => {
    const client = makeClient([{ count: 0, links: {}, results: [] }])
    const grid = new ErpGrid(client)
    await grid.fetchPage('vacinacao', { page: 2, extraParams: { page: 99 } })

    const [, params] = client.get.mock.calls[0]
    expect(params.page).toBe(2)
  })
})

describe('ErpGrid — operações de escrita (create/update/patch)', () => {
  it('create faz POST no slug', async () => {
    const client = { post: vi.fn().mockResolvedValue({ id: 1 }) }
    const grid = new ErpGrid(client)
    const result = await grid.create('contato', { nome: 'Novo' })
    expect(client.post).toHaveBeenCalledWith('/contato/', { nome: 'Novo' })
    expect(result).toEqual({ id: 1 })
  })

  it('update faz PUT no slug/id', async () => {
    const client = { put: vi.fn().mockResolvedValue({ id: 1, nome: 'Atualizado' }) }
    const grid = new ErpGrid(client)
    const result = await grid.update('materiais', 1, { nome: 'Atualizado' })
    expect(client.put).toHaveBeenCalledWith('/materiais/1/', { nome: 'Atualizado' })
    expect(result).toEqual({ id: 1, nome: 'Atualizado' })
  })

  it('patch faz PATCH no slug/id', async () => {
    const client = { patch: vi.fn().mockResolvedValue({ id: 1, ativo: false }) }
    const grid = new ErpGrid(client)
    const result = await grid.patch('contato', 1, { ativo: false })
    expect(client.patch).toHaveBeenCalledWith('/contato/1/', { ativo: false })
    expect(result).toEqual({ id: 1, ativo: false })
  })
})

describe('ErpGrid.fetchAll', () => {
  it('itera múltiplas páginas e agrega itens', async () => {
    const client = makeClient([
      { count: 20, links: { next: '?page=2' }, results: [{ id: 1 }, { id: 2 }] },
      { count: 20, links: { next: '?page=3' }, results: [{ id: 3 }] },
      { count: 20, links: { next: null }, results: [{ id: 4 }] },
    ])
    const grid = new ErpGrid(client)
    const collected = []

    const summary = await grid.fetchAll('vacinacao', {
      delayMs: 0,
      onPage: (items) => {
        collected.push(...items)
      },
    })

    expect(collected).toHaveLength(4)
    expect(summary.pagesRead).toBe(3)
    expect(summary.totalFetched).toBe(4)
  })

  it('espera delayMs entre páginas quando delayMs > 0', async () => {
    const client = makeClient([
      { count: 2, links: { next: '?page=2' }, results: [{ id: 1 }] },
      { count: 2, links: { next: null }, results: [{ id: 2 }] },
    ])
    const grid = new ErpGrid(client)

    const summary = await grid.fetchAll('vacinacao', { delayMs: 1 })

    expect(summary.pagesRead).toBe(2)
    expect(summary.totalFetched).toBe(2)
  })

  it('para quando onPage retorna false', async () => {
    const client = makeClient([
      { count: 10, links: { next: '?page=2' }, results: [{ id: 1 }] },
      { count: 10, links: { next: '?page=3' }, results: [{ id: 2 }] },
    ])
    const grid = new ErpGrid(client)

    const summary = await grid.fetchAll('vacinacao', {
      delayMs: 0,
      onPage: (_items, pageNum) => pageNum < 1,
    })

    expect(summary.stoppedAt).toBe(1)
    expect(summary.pagesRead).toBe(1)
    expect(summary.complete).toBe(false)
    expect(summary.nextPage).toBe(2)
  })

  const page = (next, ids) => ({
    count: 9,
    links: { next: next ? '?page=x' : null },
    results: ids.map((id) => ({ id })),
  })

  it('coleta inteira → complete: true e nextPage: null', async () => {
    const grid = new ErpGrid(makeClient([page(true, [1]), page(false, [2])]))
    const r = await grid.fetchAll('vacinacao', { delayMs: 0 })
    expect(r).toEqual({
      totalFetched: 2,
      pagesRead: 2,
      stoppedAt: null,
      complete: true,
      nextPage: null,
      possiblyRateLimited: false,
    })
  })

  it('maxPages atingido com mais páginas → complete: false e nextPage para retomar', async () => {
    const grid = new ErpGrid(makeClient([page(true, [1]), page(true, [2]), page(false, [3])]))
    const r = await grid.fetchAll('vacinacao', { delayMs: 0, maxPages: 2, startPage: 5 })
    expect(r).toMatchObject({ pagesRead: 2, complete: false, nextPage: 7 })
  })

  it('resposta vazia no MEIO da paginação lança, mesmo com allowEmpty', async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce(page(true, [1]))
        .mockRejectedValueOnce(new EmptyResponseError('vazio', { possiblyRateLimited: true })),
    }
    const grid = new ErpGrid(client)
    await expect(
      grid.fetchAll('vacinacao', { delayMs: 0, allowEmpty: true })
    ).rejects.toBeInstanceOf(EmptyResponseError)
    // allowEmpty só chegou à primeira página
    expect(client.get.mock.calls[1][1]).not.toHaveProperty('allowEmpty')
  })

  it('primeira página vazia com allowEmpty → possiblyRateLimited, não completa e retoma da página 1', async () => {
    const client = {
      get: vi
        .fn()
        .mockRejectedValue(new EmptyResponseError('vazio', { possiblyRateLimited: true })),
    }
    const r = await new ErpGrid(client).fetchAll('vacinacao', { allowEmpty: true })
    expect(r).toMatchObject({
      totalFetched: 0,
      complete: false,
      nextPage: 1,
      possiblyRateLimited: true,
    })
  })

  it('opção desconhecida lança ValidationError (antes era descartada calada)', async () => {
    const grid = new ErpGrid(makeClient([page(false, [])]))
    await expect(grid.fetchAll('vacinacao', { de: '2026-01-01' })).rejects.toThrow(
      /opção desconhecida \(de\)/
    )
    await expect(grid.fetchPage('contato', { nome: 'x' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('signal repassa ao client e interrompe a espera entre páginas', async () => {
    const client = makeClient([page(true, [1]), page(false, [2])])
    const grid = new ErpGrid(client)
    const ctl = new AbortController()
    const p = grid.fetchAll('vacinacao', {
      delayMs: 10_000,
      signal: ctl.signal,
      onPage: () => ctl.abort(new Error('cancelado')),
    })
    await expect(p).rejects.toThrow('cancelado')
    expect(client.get).toHaveBeenCalledTimes(1)
    expect(client.get.mock.calls[0][2]).toEqual({ signal: ctl.signal })
  })
})

describe('ErpGrid.pages e iteradores de domínio', () => {
  const page = (next, ids) => ({
    count: 9,
    links: { next: next ? '?page=x' : null },
    results: ids.map((id) => ({ id })),
  })

  it('pages() itera com for await e devolve a página de cada lote', async () => {
    const grid = new ErpGrid(makeClient([page(true, [1]), page(false, [2])]))
    const seen = []
    for await (const r of grid.pages('vacinacao', { delayMs: 0, onPage: () => {} })) {
      seen.push([r.page, r.items.map((i) => i.id)])
    }
    expect(seen).toEqual([
      [1, [1]],
      [2, [2]],
    ])
  })

  it.each([
    ['sanitario', SanitarioErp, 'iterVacinacoes', '/vacinacao/'],
    ['sanitario', SanitarioErp, 'iterTratamentos', '/tratamentoanimal/'],
    ['estoque', EstoqueErp, 'iterTratos', '/tratos/'],
  ])('%s.%s itera o slug certo', async (_m, Klass, method, path) => {
    const client = makeClient([page(false, [7])])
    const mod = new Klass(new ErpGrid(client), { post: vi.fn() })
    const itens = []
    for await (const r of mod[method]({ from: '2026-10-01', to: '2026-10-07' }))
      itens.push(...r.items)
    expect(itens).toEqual([{ id: 7 }])
    expect(client.get.mock.calls[0][0]).toBe(path)
  })
})

describe('safeImport', () => {
  it('preserva dados em RateLimitError', async () => {
    const result = await safeImport({
      fetch: () => {
        throw new RateLimitError('limite', { detail: 'throttled', slug: 'vacinacao' })
      },
      replace: vi.fn(),
    })
    expect(result.preserved).toBe(true)
    expect(result.reason).toBe('rate_limit_explicit')
  })

  it('preserva dados em EmptyResponseError', async () => {
    const result = await safeImport({
      fetch: () => {
        throw new EmptyResponseError('vazio', { possiblyRateLimited: true })
      },
      replace: vi.fn(),
    })
    expect(result.preserved).toBe(true)
    expect(result.reason).toBe('empty_response_possibly_rate_limited')
  })

  it('preserva dados quando fonte retorna [] (legítimo)', async () => {
    const replace = vi.fn()
    const result = await safeImport({ fetch: async () => [], replace })
    expect(result).toEqual({ preserved: true, reason: 'legitimately_empty' })
    expect(replace).not.toHaveBeenCalled()
  })

  it('troca os dados (replace) quando há dados', async () => {
    const replace = vi.fn().mockResolvedValue(undefined)
    const result = await safeImport({ fetch: async () => [{ id: 1 }, { id: 2 }], replace })
    expect(replace).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }])
    expect(result).toEqual({ preserved: false, inserted: 2 })
  })

  it('aceita { items, complete } e recusa coleta incompleta', async () => {
    const replace = vi.fn()
    expect(
      await safeImport({ fetch: async () => ({ items: [{ id: 1 }], complete: false }), replace })
    ).toEqual({ preserved: true, reason: 'incomplete' })
    expect(replace).not.toHaveBeenCalled()
    expect(
      await safeImport({ fetch: async () => ({ items: [{ id: 1 }], complete: true }), replace })
    ).toEqual({ preserved: false, inserted: 1 })
  })

  it('{ items: [], possiblyRateLimited } preserva como possível limite de requisições', async () => {
    const r = await safeImport({
      fetch: async () => ({ items: [], complete: true, possiblyRateLimited: true }),
      replace: vi.fn(),
    })
    expect(r).toEqual({ preserved: true, reason: 'empty_response_possibly_rate_limited' })
    expect(await safeImport({ fetch: async () => null, replace: vi.fn() })).toEqual({
      preserved: true,
      reason: 'legitimately_empty',
    })
  })

  it('não chama replace se fetch lança outros erros', async () => {
    const replace = vi.fn()
    await expect(
      safeImport({
        fetch: () => {
          throw new Error('network error')
        },
        replace,
      })
    ).rejects.toThrow('network error')
    expect(replace).not.toHaveBeenCalled()
  })

  it('chama onRateLimit quando detecta limite de requisições', async () => {
    const onRateLimit = vi.fn()
    await safeImport({
      fetch: () => {
        throw new RateLimitError('limite', { detail: 'x', slug: 'y' })
      },
      replace: vi.fn(),
      onRateLimit,
    })
    expect(onRateLimit).toHaveBeenCalledOnce()
  })

  it('a API antiga (delete + insert) lança ValidationError explicando o replace', async () => {
    await expect(
      safeImport({ fetch: async () => [], insert: vi.fn(), delete: vi.fn() })
    ).rejects.toThrow(/replace\(items\)/)
  })

  it('sem fetch/replace lança ValidationError', async () => {
    await expect(safeImport({ fetch: async () => [] })).rejects.toBeInstanceOf(ValidationError)
    await expect(safeImport()).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('ErpGrid.fetchPage allowEmpty', () => {
  it('retorna items:[] sem lançar quando allowEmpty:true e EmptyResponseError', async () => {
    const client = {
      get: vi
        .fn()
        .mockRejectedValue(new EmptyResponseError('vazio', { possiblyRateLimited: true })),
    }
    const grid = new ErpGrid(client)
    const result = await grid.fetchPage('categoria', { allowEmpty: true })
    expect(result.items).toHaveLength(0)
    expect(result.count).toBe(0)
    expect(result.hasMore).toBe(false)
    expect(result.possiblyRateLimited).toBe(true)
  })

  it('reason padrão é "possibly_rate_limited" quando emptyReason não é informado', async () => {
    const client = {
      get: vi
        .fn()
        .mockRejectedValue(new EmptyResponseError('vazio', { possiblyRateLimited: true })),
    }
    const grid = new ErpGrid(client)
    const result = await grid.fetchPage('categoria', { allowEmpty: true })
    expect(result.reason).toBe('possibly_rate_limited')
  })

  it('relança EmptyResponseError quando allowEmpty:false (padrão)', async () => {
    const client = {
      get: vi
        .fn()
        .mockRejectedValue(new EmptyResponseError('vazio', { possiblyRateLimited: true })),
    }
    const grid = new ErpGrid(client)
    await expect(grid.fetchPage('vacinacao', {})).rejects.toBeInstanceOf(EmptyResponseError)
  })

  // Nenhum método liga allowEmpty sozinho: "costuma vir vazio" depende do
  // cliente, não da API — quem chama decide.
  it.each([
    ['getCategorias', () => new CadastrosErp(new ErpGrid(emptyClient()))],
    ['getRebanhos', () => new CadastrosErp(new ErpGrid(emptyClient()))],
    ['getExames', () => new SanitarioErp(new ErpGrid(emptyClient()))],
    ['getProtocolos', () => new SanitarioErp(new ErpGrid(emptyClient()))],
  ])(
    '%s: vazio lança por padrão; com allowEmpty vira resultado vazio',
    async (method, makeModule) => {
      const mod = makeModule()
      await expect(mod[method]()).rejects.toBeInstanceOf(EmptyResponseError)
      const result = await mod[method]({ allowEmpty: true })
      expect(result).toMatchObject({ items: [], possiblyRateLimited: true })
    }
  )
})

function emptyClient() {
  return {
    get: vi.fn().mockRejectedValue(new EmptyResponseError('vazio', { possiblyRateLimited: true })),
  }
}

describe('EstoqueErp.getSobraCocho', () => {
  // Reclassificado: não lança mais EndpointUnavailableError — funciona
  // quando filtrado por data (ver comentário em src/erp/estoque.js).
  it('delega ao grid com o slug correto, repassa from/to e usa o prazo de 300 s do registro', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const estoque = new EstoqueErp(new ErpGrid(client), { post: vi.fn() })
    const result = await estoque.getSobraCocho({ from: '2026-06-27', to: '2026-07-04', page: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/sobracocho/',
      expect.objectContaining({ data_0: '2026-06-27', data_1: '2026-07-04', page: 1 }),
      { timeoutMs: 300_000 }
    )
    expect(result.items).toHaveLength(1)
  })
})

describe('EstoqueErp endpoints inviáveis', () => {
  const estoque = new EstoqueErp(new ErpGrid({ get: vi.fn() }), { post: vi.fn() })

  it('getMovimentacaoMaterial lança EndpointUnavailableError com workaround', () => {
    try {
      estoque.getMovimentacaoMaterial()
    } catch (e) {
      expect(e).toBeInstanceOf(EndpointUnavailableError)
      expect(typeof e.workaround).toBe('string')
    }
  })

  it('getViaAplicacaoTratamento lança EndpointUnavailableError', () => {
    expect(() => estoque.getViaAplicacaoTratamento()).toThrowError(EndpointUnavailableError)
  })
})

// Endpoints adicionais de auditoria/replicação — ver src/erp/auditoria.js.
describe('AuditoriaErp', () => {
  it('getAuditoria delega ao grid com o slug correto e repassa from/to', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const auditoria = new AuditoriaErp(new ErpGrid(client))
    const result = await auditoria.getAuditoria({ from: '2026-07-04', to: '2026-07-05', page: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/auditoria/',
      expect.objectContaining({ data_0: '2026-07-04', data_1: '2026-07-05', page: 1 })
    )
    expect(result.items).toHaveLength(1)
  })

  it('getRegrasDeReplicacao delega ao grid com o slug correto', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const auditoria = new AuditoriaErp(new ErpGrid(client))
    await auditoria.getRegrasDeReplicacao({ page: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/regradereplicacao/',
      expect.objectContaining({ page: 1 })
    )
  })

  it('getEntidadeRegraDeReplicacao lança EndpointUnavailableError (HTTP 500 confirmado)', () => {
    const auditoria = new AuditoriaErp(new ErpGrid({ get: vi.fn() }))
    expect(() => auditoria.getEntidadeRegraDeReplicacao()).toThrowError(EndpointUnavailableError)
  })

  it.each(['getLogDeReplicacao', 'getLogReplicacaoAnimaisNaoExcluidos'])(
    '%s: vazio lança por padrão; com allowEmpty vira resultado vazio',
    async (method) => {
      const auditoria = new AuditoriaErp(new ErpGrid(emptyClient()))
      await expect(auditoria[method]()).rejects.toBeInstanceOf(EmptyResponseError)
      const result = await auditoria[method]({ allowEmpty: true })
      expect(result.items).toHaveLength(0)
    }
  )

  it('getConfiguracoesGerais delega ao grid com o slug correto', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const auditoria = new AuditoriaErp(new ErpGrid(client))
    await auditoria.getConfiguracoesGerais()
    expect(client.get).toHaveBeenCalledWith('/configuracoesgerais/', expect.objectContaining({}))
  })

  it('getUsuarios delega ao grid com o slug correto', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const auditoria = new AuditoriaErp(new ErpGrid(client))
    await auditoria.getUsuarios()
    expect(client.get).toHaveBeenCalledWith('/usuario/', expect.objectContaining({}))
  })
})

// Endpoints adicionais — ver comentários em
// src/erp/estoque.js e src/erp/animais.js.
describe('Endpoints adicionais de itens e históricos', () => {
  it('estoque.getMovimentacaoMaterialItens delega ao grid com o slug correto', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const estoque = new EstoqueErp(new ErpGrid(client), { post: vi.fn() })
    await estoque.getMovimentacaoMaterialItens({ page: 3 })
    expect(client.get).toHaveBeenCalledWith(
      '/movimentacaomaterialitem/',
      expect.objectContaining({ page: 3 })
    )
  })

  // O servidor ignora o filtro de data destes grids (docs/api.md):
  // aceitar from/to calado faria quem chama achar que recebeu só a janela.
  // A recusa fica no grid, por slug: vale para o método de domínio e para o
  // grid direto (fetchPage, pages, fetchAll).
  it.each([
    ['estoque', 'getMovimentacaoMaterialItens', 'movimentacaomaterialitem'],
    ['estoque', 'getGtas', 'gta'],
    ['animais', 'getSaidas', 'saida'],
    [
      'animais',
      'getHistoricoMovimentacaoConfinamento',
      'historicomovimentacaolocalizacaoconfinamento',
    ],
    ['animais', 'getMedicoesPesagem', 'medicoespesagem'],
  ])('%s.%s recusa from/to (filtro ignorado pela API)', async (mod, method, slug) => {
    const client = { get: vi.fn() }
    const grid = new ErpGrid(client)
    const inst =
      mod === 'estoque'
        ? new EstoqueErp(grid, { post: vi.fn() })
        : new AnimaisErp(grid, { post: vi.fn(), put: vi.fn() })
    await expect(inst[method]({ from: '2026-07-01' })).rejects.toThrow(
      new RegExp(`^${slug}: a API MultBovinos ignora o filtro de data`)
    )
    const err = await inst[method]({ to: '2026-07-05' }).catch((e) => e)
    expect(err).toBeInstanceOf(ValidationError)
    expect(err).toMatchObject({ field: 'from/to', received: { from: undefined, to: '2026-07-05' } })
    await expect(grid.fetchAll(slug, { from: '2026-07-01' })).rejects.toBeInstanceOf(
      ValidationError
    )
    expect(() => grid.pages(slug, { to: '2026-07-05' })).toThrow(ValidationError)
    expect(client.get).not.toHaveBeenCalled()
  })

  it('o mesmo grid sem from/to segue normal; outros grids aceitam from/to', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const grid = new ErpGrid(client)
    await expect(grid.fetchPage('gta', { page: 2 })).resolves.toMatchObject({ count: 1 })
    await grid.fetchPage('tratos', { from: '2026-07-01', to: '2026-07-05' })
    expect(client.get).toHaveBeenLastCalledWith('/tratos/', {
      page: 1,
      data_0: '2026-07-01',
      data_1: '2026-07-05',
    })
  })

  it('estoque.getTratosItens delega ao grid com o slug correto', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const estoque = new EstoqueErp(new ErpGrid(client), { post: vi.fn() })
    await estoque.getTratosItens({ page: 1 })
    expect(client.get).toHaveBeenCalledWith('/tratositem/', expect.objectContaining({ page: 1 }))
  })

  it('estoque.getAplicacaoConsumoLoteAnimal delega ao grid com o slug correto', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const estoque = new EstoqueErp(new ErpGrid(client), { post: vi.fn() })
    await estoque.getAplicacaoConsumoLoteAnimal({ page: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/aplicacaoconsumoloteanimal/',
      expect.objectContaining({ page: 1 })
    )
  })

  it('estoque.getAplicacaoConsumoLoteAnimalIntercorrencia delega ao grid com o slug correto', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const estoque = new EstoqueErp(new ErpGrid(client), { post: vi.fn() })
    await estoque.getAplicacaoConsumoLoteAnimalIntercorrencia({ page: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/aplicacaoconsumoloteanimalintercorrencia/',
      expect.objectContaining({ page: 1 })
    )
  })

  it('estoque.getAplicacaoConsumoLoteAnimalIntercorrencia traduz from/to para periodo_0/_1 (o filtro real do servidor)', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 0, results: [], links: {} }) }
    const estoque = new EstoqueErp(new ErpGrid(client), { post: vi.fn() })
    await estoque.getAplicacaoConsumoLoteAnimalIntercorrencia({
      from: '2026-07-01',
      to: '2026-07-05',
      page: 1,
    })
    expect(client.get).toHaveBeenCalledWith('/aplicacaoconsumoloteanimalintercorrencia/', {
      periodo_0: '2026-07-01',
      periodo_1: '2026-07-05',
      page: 1,
    })
    // data_0/data_1 (mapeamento padrão do grid) é ignorado pelo servidor —
    // não pode vazar na query
    const params = client.get.mock.calls[0][1]
    expect(params.data_0).toBeUndefined()
    expect(params.data_1).toBeUndefined()
  })

  it('animais.getHistoricoMovimentacaoConfinamento delega ao grid com o slug correto', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const animais = new AnimaisErp(new ErpGrid(client), { post: vi.fn(), put: vi.fn() })
    await animais.getHistoricoMovimentacaoConfinamento({ page: 2 })
    expect(client.get).toHaveBeenCalledWith(
      '/historicomovimentacaolocalizacaoconfinamento/',
      expect.objectContaining({ page: 2 })
    )
  })

  it('animais.getHistoricoMovimentacaoLocalidades delega ao grid com o slug correto', async () => {
    const client = { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
    const animais = new AnimaisErp(new ErpGrid(client), { post: vi.fn(), put: vi.fn() })
    await animais.getHistoricoMovimentacaoLocalidades({ page: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/historicomovimentacaolocalizacaolocalidades/',
      expect.objectContaining({ page: 1 })
    )
  })

  it('animais.getConfinamento lista os lotes e traduz from/to para data_abertura', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ count: 1, links: {}, results: [{ id: 101 }] }),
      post: vi.fn(),
      put: vi.fn(),
    }
    const animais = new AnimaisErp(new ErpGrid(client), client)
    const page = await animais.getConfinamento({ from: '2026-10-01', to: '2026-10-28' })
    expect(page.items).toEqual([{ id: 101 }])
    expect(client.get).toHaveBeenCalledWith('/confinamento/', {
      page: 1,
      data_abertura_0: '2026-10-01',
      data_abertura_1: '2026-10-28',
    })
  })

  it('animais.getConfinamentoById busca o registro individual (a busca por id funciona, só a listagem tem o bug)', async () => {
    const lot = { id: 101, data_abertura: '2026-07-06', animais: [{ animal_id: 7 }] }
    const client = { get: vi.fn().mockResolvedValue(lot), post: vi.fn(), put: vi.fn() }
    const animais = new AnimaisErp(new ErpGrid(client), client)
    const result = await animais.getConfinamentoById(101)
    expect(client.get).toHaveBeenCalledWith('/confinamento/101/', { format: 'json' })
    // retorna o corpo cru, sem parse BR — a resposta da busca por id já vem em JSON limpo
    expect(result).toBe(lot)
  })

  it('animais.getConfinamentoById rejeita id ausente ou inválido com ValidationError', async () => {
    const client = { get: vi.fn(), post: vi.fn(), put: vi.fn() }
    const animais = new AnimaisErp(new ErpGrid(client), client)
    await expect(animais.getConfinamentoById()).rejects.toThrowError(ValidationError)
    await expect(animais.getConfinamentoById(0)).rejects.toThrowError(ValidationError)
    await expect(animais.getConfinamentoById('101')).rejects.toThrowError(ValidationError)
    expect(client.get).not.toHaveBeenCalled()
  })
})

// Reinvestigação dos endpoints ❌ — recuperações via busca por id e
// sub-rotas (mesmo padrão do confinamento), e o filtro real de data de
// tratositem.
describe('Reinvestigação — recuperações de endpoints ❌', () => {
  it('estoque.getMovimentacaoMaterialById busca o registro individual (a listagem segue 500)', async () => {
    const mov = { id: 202, data: '2012-01-01', itens: [{ id: 8 }] }
    const client = { get: vi.fn().mockResolvedValue(mov) }
    const estoque = new EstoqueErp(new ErpGrid(client), client)
    const result = await estoque.getMovimentacaoMaterialById(202)
    expect(client.get).toHaveBeenCalledWith('/movimentacaomaterial/202/', { format: 'json' })
    // corpo cru, sem parse BR — a busca por id já vem em JSON limpo
    expect(result).toBe(mov)
  })

  it('estoque.getMovimentacaoMaterialById rejeita id ausente ou inválido com ValidationError', async () => {
    const client = { get: vi.fn() }
    const estoque = new EstoqueErp(new ErpGrid(client), client)
    await expect(estoque.getMovimentacaoMaterialById()).rejects.toThrowError(ValidationError)
    await expect(estoque.getMovimentacaoMaterialById(0)).rejects.toThrowError(ValidationError)
    await expect(estoque.getMovimentacaoMaterialById('202')).rejects.toThrowError(ValidationError)
    expect(client.get).not.toHaveBeenCalled()
  })

  it('estoque.getTratosItens traduz from/to para movimentacao_material__data_0/_1 (o filtro real do servidor)', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ count: 176, results: [{ id: 1 }], links: {} }),
    }
    const estoque = new EstoqueErp(new ErpGrid(client), client)
    await estoque.getTratosItens({ from: '10/07/2026', to: '11/07/2026', page: 2 })
    expect(client.get).toHaveBeenCalledWith('/tratositem/', {
      movimentacao_material__data_0: '10/07/2026',
      movimentacao_material__data_1: '11/07/2026',
      page: 2,
    })
    // data_0/data_1 (mapeamento padrão do grid) é ignorado pelo servidor —
    // não pode vazar na query
    const params = client.get.mock.calls[0][1]
    expect(params.data_0).toBeUndefined()
    expect(params.data_1).toBeUndefined()
  })

  it('estoque.getTratosItens preserva extraParams (localidade= etc.) junto com a tradução de from/to', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ count: 523, results: [{ id: 1 }], links: {} }),
    }
    const estoque = new EstoqueErp(new ErpGrid(client), client)
    await estoque.getTratosItens({ from: '10/07/2026', extraParams: { localidade: 999 } })
    expect(client.get).toHaveBeenCalledWith(
      '/tratositem/',
      expect.objectContaining({ movimentacao_material__data_0: '10/07/2026', localidade: 999 })
    )
  })

  it('auditoria.getEntidadeRegraDeReplicacaoById busca o registro individual do catálogo', async () => {
    const entityType = { id: 10, descricao: 'LOCALIZAÇÃO' }
    const client = { get: vi.fn().mockResolvedValue(entityType) }
    const auditoria = new AuditoriaErp(new ErpGrid(client), client)
    const result = await auditoria.getEntidadeRegraDeReplicacaoById(10)
    expect(client.get).toHaveBeenCalledWith('/entidaderegradereplicacao/10/', { format: 'json' })
    expect(result).toBe(entityType)
  })

  it('auditoria.getEntidadeRegraDeReplicacaoById rejeita id inválido com ValidationError', async () => {
    const client = { get: vi.fn() }
    const auditoria = new AuditoriaErp(new ErpGrid(client), client)
    await expect(auditoria.getEntidadeRegraDeReplicacaoById()).rejects.toThrowError(ValidationError)
    await expect(auditoria.getEntidadeRegraDeReplicacaoById(-1)).rejects.toThrowError(
      ValidationError
    )
    expect(client.get).not.toHaveBeenCalled()
  })

  it('estoque.getMovimentacaoMaterialItemById busca o item individual (a listagem não tem filtro nenhum)', async () => {
    const item = { id: 303, data: '11/07/2026', movimentacao_material: 202 }
    const client = { get: vi.fn().mockResolvedValue(item) }
    const estoque = new EstoqueErp(new ErpGrid(client), client)
    const result = await estoque.getMovimentacaoMaterialItemById(303)
    expect(client.get).toHaveBeenCalledWith('/movimentacaomaterialitem/303/', {
      format: 'json',
    })
    // corpo cru — data permanece em formato BR, sem parse
    expect(result).toBe(item)
  })

  it('estoque.getMovimentacaoMaterialItemById rejeita id inválido com ValidationError', async () => {
    const client = { get: vi.fn() }
    const estoque = new EstoqueErp(new ErpGrid(client), client)
    await expect(estoque.getMovimentacaoMaterialItemById()).rejects.toThrowError(ValidationError)
    await expect(estoque.getMovimentacaoMaterialItemById(-5)).rejects.toThrowError(ValidationError)
    expect(client.get).not.toHaveBeenCalled()
  })

  it('auditoria.getHistoricoExecucaoViewPgUltimosItensFila usa a sub-rota ultimos-itens-fila/', async () => {
    const queue = { dados: [{ id: 11, status_texto: 'Execução finalizada' }] }
    const client = { get: vi.fn().mockResolvedValue(queue) }
    const auditoria = new AuditoriaErp(new ErpGrid(client), client)
    const result = await auditoria.getHistoricoExecucaoViewPgUltimosItensFila()
    expect(client.get).toHaveBeenCalledWith('/historicoexecucaoviewpg/ultimos-itens-fila/', {
      format: 'json',
    })
    expect(result).toBe(queue)
  })
})

describe('Grid × fila de fazenda (Auth real)', () => {
  function setupGrid() {
    const auth = new Auth('u@test.com', 'pass', {
      token: 'tok',
      properties: [
        { id: 1, nome: 'A' },
        { id: 2, nome: 'B' },
      ],
    })
    const selectClient = { postRaw: vi.fn(async () => ({})) }
    const pageOf = (next) => ({
      count: 9,
      links: { next: next ? '?p' : null },
      results: [{ id: 1 }],
    })
    const client = { get: vi.fn(async (_p, params) => pageOf(params.page < 3)) }
    return { auth, selectClient, grid: new ErpGrid(client, auth), client }
  }

  it('troca de fazenda entre duas páginas → PropertyNotSelectedError, sem misturar', async () => {
    const { auth, selectClient, grid, client } = setupGrid()
    await auth.withProperty(selectClient, 1, async () => {})
    const onPage = vi.fn(async (_items, page) => {
      if (page === 1) await auth.withProperty(selectClient, 2, async () => {})
    })
    const err = await grid.fetchAll('tratos', { delayMs: 0, onPage }).catch((e) => e)
    expect(err).toBeInstanceOf(PropertyNotSelectedError)
    expect(err).toMatchObject({ endpoint: 'tratos', reason: 'changed_during_pagination' })
    expect(err.message).toMatch(/mudou durante a paginação de tratos/)
    // A checagem é feita pelo paginate() sobre a marca que a página traz, logo
    // depois da resposta: a página 2 chega a ser requisitada, mas veio da
    // outra fazenda e nunca é entregue a quem consome (onPage só viu a 1).
    expect(client.get).toHaveBeenCalledTimes(2)
    expect(onPage).toHaveBeenCalledTimes(1)
  })

  it('a guarda vale para paginate() sobre qualquer método de grid, não só grid.pages()', async () => {
    const { auth, selectClient, grid, client } = setupGrid()
    const estoque = new EstoqueErp(grid)
    await auth.withProperty(selectClient, 1, async () => {})
    const delivered = []
    const err = await (async () => {
      for await (const { page } of paginate((p) => estoque.getGtas(p))) {
        delivered.push(page)
        if (page === 1) await auth.withProperty(selectClient, 2, async () => {})
      }
    })().catch((e) => e)
    expect(err).toBeInstanceOf(PropertyNotSelectedError)
    expect(err).toMatchObject({ endpoint: 'gta', reason: 'changed_during_pagination' })
    expect(delivered).toEqual([1]) // a página 2, da outra fazenda, não foi entregue
    expect(client.get).toHaveBeenCalledTimes(2)
  })

  it('a marca não aparece no resultado (não enumerável) e o paginate não a repassa', async () => {
    const { auth, selectClient, grid } = setupGrid()
    await auth.withProperty(selectClient, 1, async () => {})
    const r = await grid.fetchPage('tratos', { page: 3 })
    expect(r).toStrictEqual({
      items: [{ id: 1 }],
      count: 9,
      hasMore: false,
      nextPage: null,
      filters: null,
      modelo: null,
    })
    expect(Object.keys(r)).toEqual(['items', 'count', 'hasMore', 'nextPage', 'filters', 'modelo'])
    expect(JSON.parse(JSON.stringify(r))).toEqual(r)
    expect(r[SELECTION]).toEqual({ generation: auth.getSelectionGeneration(), slug: 'tratos' })
    for await (const p of paginate((q) => grid.fetchPage('tratos', q), { page: 3 })) {
      expect(Object.getOwnPropertySymbols(p)).toEqual([])
    }
  })

  it('sem troca, pagina até o fim; uma página e uma troca nunca rodam juntas', async () => {
    const { auth, selectClient, grid } = setupGrid()
    await auth.withProperty(selectClient, 1, async () => {})
    const r = await grid.fetchAll('tratos', { delayMs: 0 })
    expect(r).toMatchObject({ pagesRead: 3, complete: true })
  })
})
