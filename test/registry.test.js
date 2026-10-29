// Registro por endpoint (src/erp/registry.js) e o que ele governa no grid:
// filtro de data, propertyId por escopo, prazo sugerido, coleta completa e o
// acesso genérico mb.erp.fetchPage/pages/collect.
import { describe, it, expect, vi } from 'vitest'
import { Auth } from '../src/auth.js'
import { ErpGrid } from '../src/erp/grid.js'
import { ErpApi } from '../src/erp/index.js'
import { endpointInfo, registeredSlugs, SCOPES } from '../src/erp/registry.js'
import { ERP_SLUGS } from '../src/constants.js'
import { collectPages } from '../src/helpers/paginate.js'
import { PropertyNotSelectedError, ValidationError } from '../src/errors.js'

function setup({ pages = 1, filters, modelo } = {}) {
  const auth = new Auth('u@test.com', 'pass', {
    token: 'tok',
    properties: [
      { id: 1, nome: 'A' },
      { id: 2, nome: 'B' },
    ],
  })
  const client = {
    postRaw: vi.fn(async () => ({})),
    get: vi.fn(async (_path, params) => ({
      count: 3,
      links: { next: params.page < pages ? '?p' : null },
      results: [{ id: params.page }],
      filters,
      modelo,
    })),
  }
  return { auth, client, grid: new ErpGrid(client, auth) }
}

const selects = (client) => client.postRaw.mock.calls.length

describe('registry', () => {
  it('slug fora do registro: escopo desconhecido e filtro de data não testado', () => {
    expect(endpointInfo('qualquer')).toEqual({
      slug: 'qualquer',
      scope: 'unknown',
      dateParam: 'data',
      dateTested: false,
      timeoutMs: undefined,
      recordPropertyField: null,
    })
  })

  it.each([
    [ERP_SLUGS.LOCALIZACAO, 'property'],
    [ERP_SLUGS.INVENTARIO_ANIMAIS, 'property'],
    [ERP_SLUGS.RACA, 'contract'],
    [ERP_SLUGS.CONFIGURACOES_GERAIS, 'contract'],
    [ERP_SLUGS.AUDITORIA, 'global'],
    [ERP_SLUGS.HISTORICO_MOVIMENTACAO_PROGRAMA_NUTRICIONAL, 'global'],
    [ERP_SLUGS.MEDICOES_PESAGEM, 'leaks'],
    [ERP_SLUGS.TRATOS, 'property'],
    [ERP_SLUGS.TRANSFERENCIA_PROPRIEDADE, 'contract'],
    [ERP_SLUGS.PROTOCOLO, 'unknown'],
    [ERP_SLUGS.SOBRA_COCHO, 'property'],
    [ERP_SLUGS.MACHO, 'property'],
    [ERP_SLUGS.USUARIO, 'contract'],
    [ERP_SLUGS.HISTORICO_ACOES_APP, 'contract'],
  ])('%s → escopo %s', (slug, scope) => {
    expect(endpointInfo(slug).scope).toBe(scope)
    expect(SCOPES).toContain(scope)
  })

  it.each([
    [ERP_SLUGS.TRATOS, 'data', true],
    [ERP_SLUGS.TRATOS_ITEM, 'movimentacao_material__data', true],
    [ERP_SLUGS.APLICACAO_CONSUMO_LOTE_ANIMAL_INTERCORRENCIA, 'periodo', true],
    [ERP_SLUGS.INVENTARIO_ANIMAIS, null, true],
    [ERP_SLUGS.GTA, null, true],
    [ERP_SLUGS.PROTOCOLO, 'data', false],
    [ERP_SLUGS.MACHO, null, true],
    [ERP_SLUGS.HISTORICO_ACOES_APP, 'data', true],
  ])('%s → filtro %s (testado: %s)', (slug, dateParam, dateTested) => {
    expect(endpointInfo(slug)).toMatchObject({ dateParam, dateTested })
  })

  it.each([
    [ERP_SLUGS.TRATOS, 'propriedade'],
    [ERP_SLUGS.SOBRA_COCHO, 'propriedade'],
    [ERP_SLUGS.TRATOS_ITEM, null],
    [ERP_SLUGS.PROTOCOLO, null],
  ])('%s → campo de fazenda %s', (slug, field) => {
    expect(endpointInfo(slug).recordPropertyField).toBe(field)
  })

  it('sobra de cocho tem prazo sugerido de 300 s', () => {
    expect(endpointInfo(ERP_SLUGS.SOBRA_COCHO).timeoutMs).toBe(300_000)
  })

  it('todo slug registrado existe nas constantes, em ordem', () => {
    const slugs = registeredSlugs()
    expect(slugs).toEqual([...slugs].sort())
    const known = new Set(Object.values(ERP_SLUGS))
    expect(slugs.filter((s) => !known.has(s))).toEqual([])
  })
})

describe('grid — filtro de data pelo registro', () => {
  it('inventarioanimais recusa from/to (o servidor ignora)', async () => {
    const { grid, client } = setup()
    await expect(
      grid.fetchPage(ERP_SLUGS.INVENTARIO_ANIMAIS, { from: '2026-10-01' })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(client.get).not.toHaveBeenCalled()
  })

  it('tratositem traduz from/to para o filtro aninhado', async () => {
    const { grid, client, auth } = setup()
    await auth.withProperty(client, 1, async () => {})
    await grid.fetchPage(ERP_SLUGS.TRATOS_ITEM, { from: '2026-10-01', to: '2026-10-07' })
    expect(client.get).toHaveBeenCalledWith('/tratositem/', {
      page: 1,
      movimentacao_material__data_0: '2026-10-01',
      movimentacao_material__data_1: '2026-10-07',
    })
  })

  it('dateParam explícito troca o do registro', async () => {
    const { grid, client } = setup()
    await grid.fetchPage('qualquer', { from: '2026-10-01', dateParam: 'periodo' })
    expect(client.get).toHaveBeenCalledWith('/qualquer/', { page: 1, periodo_0: '2026-10-01' })
  })

  it('devolve filters e modelo da resposta', async () => {
    const { grid } = setup({ filters: [{ nome: 'data' }], modelo: 'venda' })
    const r = await grid.fetchPage('qualquer')
    expect(r).toMatchObject({ filters: [{ nome: 'data' }], modelo: 'venda' })
  })
})

describe('grid — prazo por chamada', () => {
  it('o prazo sugerido nunca encurta o prazo da instância', async () => {
    const { grid, client, auth } = setup()
    await auth.withProperty(client, 1, async () => {})
    client.timeoutMs = 900_000
    await grid.fetchPage(ERP_SLUGS.SOBRA_COCHO)
    expect(client.get).toHaveBeenLastCalledWith('/sobracocho/', { page: 1 }, { timeoutMs: 900_000 })
  })

  it('dateParam explícito vale até num grid cujo filtro o registro marca como ignorado', async () => {
    const { grid, client, auth } = setup()
    await auth.withProperty(client, 1, async () => {})
    await grid.fetchPage(ERP_SLUGS.INVENTARIO_ANIMAIS, {
      from: '2026-10-01',
      dateParam: 'data_hora',
    })
    expect(client.get).toHaveBeenLastCalledWith('/inventarioanimais/', {
      page: 1,
      data_hora_0: '2026-10-01',
    })
  })

  it('timeoutMs e signal da chamada vão para o cliente HTTP; o do registro é o padrão', async () => {
    const { grid, client, auth } = setup()
    await auth.withProperty(client, 1, async () => {})
    const signal = new AbortController().signal
    await grid.fetchPage('qualquer', { timeoutMs: 1000, signal })
    expect(client.get).toHaveBeenLastCalledWith(
      '/qualquer/',
      { page: 1 },
      {
        signal,
        timeoutMs: 1000,
      }
    )
    await grid.fetchPage(ERP_SLUGS.SOBRA_COCHO, { timeoutMs: 5 }).catch(() => {})
    expect(client.get).toHaveBeenLastCalledWith('/sobracocho/', { page: 1 }, { timeoutMs: 5 })
  })
})

describe('grid — propertyId conforme o escopo', () => {
  it.each([
    [ERP_SLUGS.RACA, /conta inteira/],
    [ERP_SLUGS.AUDITORIA, /ignora a fazenda/],
    [ERP_SLUGS.MEDICOES_PESAGEM, /outras fazendas/],
  ])('%s recusa propertyId antes de qualquer chamada', async (slug, msg) => {
    const { grid, client } = setup()
    const err = await grid.fetchPage(slug, { propertyId: 1 }).catch((e) => e)
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.field).toBe('propertyId')
    expect(err.message).toMatch(msg)
    expect(client.get).not.toHaveBeenCalled()
  })

  it('propertyId inválido → ValidationError', async () => {
    const { grid } = setup()
    await expect(grid.fetchPage('qualquer', { propertyId: 0 })).rejects.toBeInstanceOf(
      ValidationError
    )
  })

  it('endpoint por fazenda: seleciona uma vez e lê as páginas seguintes sem nova seleção', async () => {
    const { grid, client, auth } = setup({ pages: 3 })
    const r = await grid.collect(ERP_SLUGS.MORTE, { propertyId: 2 })
    expect(r.items.map((i) => i.id)).toEqual([1, 2, 3])
    expect(r).toMatchObject({ complete: true, nextPage: null, pagesRead: 3 })
    expect(r.scope).toBeUndefined()
    expect(selects(client)).toBe(1)
    expect(auth.getSelectedPropertyId()).toBe(2)
  })

  it('fazenda já selecionada: não seleciona de novo', async () => {
    const { grid, client, auth } = setup()
    await auth.withProperty(client, 1, async () => {})
    await grid.fetchPage(ERP_SLUGS.MORTE, { propertyId: 1 })
    expect(selects(client)).toBe(1)
  })

  it('escopo desconhecido: seleciona e marca scope "unverified" na página, no fetchAll e no collect', async () => {
    const { grid } = setup({ pages: 2 })
    const page = await grid.fetchPage(ERP_SLUGS.PROTOCOLO, { propertyId: 1 })
    expect(page.scope).toBe('unverified')
    const all = await grid.fetchAll(ERP_SLUGS.PROTOCOLO, { propertyId: 1 })
    expect(all.scope).toBe('unverified')
    const col = await grid.collect(ERP_SLUGS.PROTOCOLO, { propertyId: 1 })
    expect(col.scope).toBe('unverified')
  })

  it('endpoint por fazenda sem propertyId e sem seleção → PropertyNotSelectedError', async () => {
    const { grid, client, auth } = setup()
    const err = await grid.fetchPage(ERP_SLUGS.MORTE).catch((e) => e)
    expect(err).toBeInstanceOf(PropertyNotSelectedError)
    expect(err.endpoint).toBe('morte')
    expect(client.get).not.toHaveBeenCalled()
    await auth.withProperty(client, 1, async () => {})
    await expect(grid.fetchPage(ERP_SLUGS.MORTE)).resolves.toMatchObject({ count: 3 })
  })

  it('escopo desconhecido sem propertyId não exige seleção (comportamento de antes)', async () => {
    const { grid } = setup()
    await expect(grid.fetchPage(ERP_SLUGS.PROTOCOLO)).resolves.toMatchObject({ count: 3 })
  })

  it('com propertyId, outra troca no meio da coleta: a página seguinte volta à fazenda pedida', async () => {
    const { grid, client, auth } = setup({ pages: 3 })
    const pages = grid.pages(ERP_SLUGS.MORTE, { propertyId: 1 })
    await pages.next()
    await auth.withProperty(client, 2, async () => {})
    const second = await pages.next()
    expect(second.value.page).toBe(2)
    expect(auth.getSelectedPropertyId()).toBe(1)
    expect(selects(client)).toBe(3) // 1, a troca de fora (2) e a volta para 1
  })

  it('coletas paralelas de fazendas diferentes não se derrubam', async () => {
    const { grid } = setup({ pages: 3 })
    const [a, b] = await Promise.all([
      grid.collect(ERP_SLUGS.MORTE, { propertyId: 1 }),
      grid.collect(ERP_SLUGS.MORTE, { propertyId: 2 }),
    ])
    expect(a).toMatchObject({ pagesRead: 3, complete: true })
    expect(b).toMatchObject({ pagesRead: 3, complete: true })
  })

  it('espera um relogin em andamento antes de ler (não troca a fazenda à toa)', async () => {
    const { grid, client, auth } = setup()
    await auth.withProperty(client, 1, async () => {})
    let release
    const pending = new Promise((r) => (release = r))
    vi.spyOn(auth, 'pendingRelogin').mockReturnValueOnce(pending)
    const read = grid.fetchPage(ERP_SLUGS.MORTE, { propertyId: 1 })
    await new Promise((r) => setTimeout(r, 5))
    expect(client.get).not.toHaveBeenCalled()
    release()
    await read
    expect(client.get).toHaveBeenCalledTimes(1)
    expect(selects(client)).toBe(1)
  })

  it('signal já cancelado não troca a fazenda', async () => {
    const { grid, client } = setup()
    const ctrl = new AbortController()
    ctrl.abort(new Error('cancelado'))
    await expect(
      grid.fetchPage(ERP_SLUGS.MORTE, { propertyId: 2, signal: ctrl.signal })
    ).rejects.toThrow('cancelado')
    expect(selects(client)).toBe(0)
  })

  it('grid sem sessão não aceita propertyId', async () => {
    const client = { get: vi.fn() }
    const err = await new ErpGrid(client).fetchPage('qualquer', { propertyId: 1 }).catch((e) => e)
    expect(err).toBeInstanceOf(ValidationError)
    expect(client.get).not.toHaveBeenCalled()
  })
})

describe('collectPages', () => {
  it('iterador vazio → coleta vazia e completa', async () => {
    async function* none() {}
    await expect(collectPages(none())).resolves.toEqual({
      items: [],
      pagesRead: 0,
      complete: true,
      nextPage: null,
      possiblyRateLimited: false,
    })
  })

  it('maxPages interrompe: complete false e nextPage de onde retomar', async () => {
    const { grid } = setup({ pages: 5 })
    const r = await grid.collect('qualquer', { maxPages: 2 })
    expect(r).toMatchObject({ pagesRead: 2, complete: false, nextPage: 3 })
    expect(r.items).toHaveLength(2)
  })

  it('primeira página vazia com allowEmpty → possiblyRateLimited', async () => {
    async function* one() {
      yield { items: [], hasMore: false, page: 1, possiblyRateLimited: true }
    }
    await expect(collectPages(one())).resolves.toMatchObject({ possiblyRateLimited: true })
  })
})

describe('mb.erp.fetchPage/pages/collect — acesso genérico pelo slug', () => {
  it('delegam ao grid com o slug', async () => {
    const { client, auth } = setup({ pages: 2 })
    const erp = new ErpApi(client, auth)
    await expect(erp.fetchPage('premistura')).resolves.toMatchObject({ count: 3 })
    const seen = []
    for await (const p of erp.pages('premistura')) seen.push(p.page)
    expect(seen).toEqual([1, 2])
    await expect(erp.collect('premistura')).resolves.toMatchObject({ pagesRead: 2 })
    expect(client.get).toHaveBeenCalledWith('/premistura/', { page: 1 })
  })

  it.each(['producaopasto/relatorio', '/tratos/', '', 5, undefined])(
    'slug inválido (%s) → ValidationError',
    (slug) => {
      const { client, auth } = setup()
      const erp = new ErpApi(client, auth)
      expect(() => erp.fetchPage(slug)).toThrow(ValidationError)
      expect(() => erp.pages(slug)).toThrow(ValidationError)
      expect(() => erp.collect(slug)).toThrow(ValidationError)
    }
  )
})

describe('grid — busca por id na fila de fazenda', () => {
  it('com sessão, a busca roda como leitura compartilhada (espera uma troca em andamento)', async () => {
    const { auth, client } = setup()
    client.get.mockResolvedValue({ id: 5 })
    const grid = new ErpGrid(client, auth)
    const order = []
    let release
    const swap = auth.exclusive(async () => {
      order.push('troca:início')
      await new Promise((r) => (release = r))
      order.push('troca:fim')
    })
    const byId = grid.fetchOneJson('confinamento', 5, 'getConfinamentoById').then((r) => {
      order.push('busca')
      return r
    })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    release()
    await expect(byId).resolves.toEqual({ id: 5 })
    await swap
    expect(order).toEqual(['troca:início', 'troca:fim', 'busca'])
  })
})

describe('grid — relogin que falha', () => {
  it('um relogin pendente que falha não impede a leitura (a requisição trata o erro)', async () => {
    const { grid, client, auth } = setup()
    await auth.withProperty(client, 1, async () => {})
    vi.spyOn(auth, 'pendingRelogin').mockReturnValueOnce(Promise.reject(new Error('falhou')))
    await expect(grid.fetchPage(ERP_SLUGS.MORTE)).resolves.toMatchObject({ count: 3 })
  })
})
