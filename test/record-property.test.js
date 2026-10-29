// verifyRecordProperty: num grid por fazenda cujo registro traz a fazenda, uma
// página com registro de outra fazenda lança PropertyNotSelectedError — sinal
// de que outra sessão com a mesma conta trocou a fazenda no servidor.
import { describe, it, expect, vi } from 'vitest'
import { Auth } from '../src/auth.js'
import { ErpGrid } from '../src/erp/grid.js'
import { MultBovinos } from '../index.js'
import { ERP_SLUGS } from '../src/constants.js'
import { PropertyNotSelectedError, ValidationError } from '../src/errors.js'

// 'fazendado': um grid por fazenda com o campo de fazenda no registro. Os do
// testes abaixo também usam o registro real (tratos, grupocurral).
vi.mock('../src/erp/registry.js', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    endpointInfo: (slug) =>
      slug === 'fazendado'
        ? { ...mod.endpointInfo(slug), scope: 'property', recordPropertyField: 'propriedade' }
        : mod.endpointInfo(slug),
  }
})

function setup(records, gridOptions) {
  const auth = new Auth('u@test.com', 'pass', {
    token: 'tok',
    properties: [
      { id: 1, nome: 'A' },
      { id: 2, nome: 'B' },
    ],
  })
  const client = {
    postRaw: vi.fn(async () => ({})),
    get: vi.fn(async () => ({ count: records.length, links: {}, results: records })),
  }
  return { auth, client, grid: new ErpGrid(client, auth, gridOptions) }
}

describe('verifyRecordProperty', () => {
  it('registros da fazenda selecionada (ou sem o campo) passam', async () => {
    const { auth, client, grid } = setup([
      { id: 1, propriedade: 1 },
      { id: 2, propriedade: '1' },
      { id: 3, propriedade: null },
      { id: 4 },
    ])
    await auth.withProperty(client, 1, () => {})
    await expect(grid.fetchPage('fazendado')).resolves.toMatchObject({ count: 4 })
  })

  it('registro de outra fazenda lança changed_by_another_session', async () => {
    const { auth, client, grid } = setup([
      { id: 1, propriedade: 1 },
      { id: 2, propriedade: 2 },
    ])
    await auth.withProperty(client, 1, () => {})
    const err = await grid.fetchPage('fazendado').catch((e) => e)
    expect(err).toBeInstanceOf(PropertyNotSelectedError)
    expect(err).toMatchObject({
      endpoint: 'fazendado',
      reason: 'changed_by_another_session',
      propertyId: 1,
      received: 2,
    })
    expect(err.message).toMatch(/mesma conta/)
  })

  it('com propertyId, confere com a fazenda pedida', async () => {
    const { grid } = setup([{ id: 1, propriedade: 2 }])
    await expect(grid.fetchPage('fazendado', { propertyId: 2 })).resolves.toMatchObject({
      count: 1,
    })
    await expect(grid.fetchPage('fazendado', { propertyId: 1 })).rejects.toBeInstanceOf(
      PropertyNotSelectedError
    )
  })

  it('no registro real: tratos traz propriedade e é conferido', async () => {
    const { auth, client, grid } = setup([{ id: 1, propriedade: 2 }])
    await auth.withProperty(client, 1, () => {})
    await expect(grid.fetchPage(ERP_SLUGS.TRATOS)).rejects.toMatchObject({
      reason: 'changed_by_another_session',
      endpoint: ERP_SLUGS.TRATOS,
    })
  })

  it('desligado, não confere', async () => {
    const { auth, client, grid } = setup([{ id: 1, propriedade: 2 }], {
      verifyRecordProperty: false,
    })
    await auth.withProperty(client, 1, () => {})
    await expect(grid.fetchPage('fazendado')).resolves.toMatchObject({ count: 1 })
  })

  it('escopo que não é por fazenda (grupocurral é da conta inteira): o campo variar é normal', async () => {
    const { auth, client, grid } = setup([{ id: 1, propriedade: 2 }])
    await auth.withProperty(client, 1, () => {})
    await expect(grid.fetchPage(ERP_SLUGS.GRUPO_CURRAL)).resolves.toMatchObject({ count: 1 })
  })

  it('sem sessão (grid sem auth) não há fazenda com que conferir', async () => {
    const client = {
      get: vi.fn(async () => ({ count: 1, links: {}, results: [{ propriedade: 9 }] })),
    }
    await expect(new ErpGrid(client).fetchPage('fazendado')).resolves.toMatchObject({ count: 1 })
  })

  it('opção da instância: só true ou false', () => {
    expect(
      () => new MultBovinos({ email: 'a', password: 'b', verifyRecordProperty: 'sim' })
    ).toThrow(ValidationError)
    expect(
      () => new MultBovinos({ email: 'a', password: 'b', verifyRecordProperty: false })
    ).not.toThrow()
  })
})
