import { describe, it, expect, vi } from 'vitest'
import { CustosErp } from '../src/erp/custos.js'
import { TIPO_SAIDA_MATERIAL } from '../src/constants.js'
import { ValidationError } from '../src/errors.js'

const DADOS = [{ categoria_texto: 'MACHOS 0-12 MESES', mes: '2026-06', valor: 6972.28 }]

function makeClient(response = { dados: DADOS }) {
  return { post: vi.fn().mockResolvedValue(response) }
}

// Auth falso mínimo: inProperty segue o roteamento real (com propertyId,
// withProperty; sem, só roda) e withProperty delega ao selectProperty
// simulado (a fila real é testada em propertyLock.test.js).
function makeAuth(propertyId = 10) {
  const auth = {
    selectProperty: vi.fn().mockResolvedValue(undefined),
    getProperties: () => [{ id: propertyId, nome: 'Fazenda A', cnpj: null }],
    withProperty: async (client, id, fn) => {
      await auth.selectProperty(client, id)
      return fn()
    },
    inProperty: vi.fn(async (client, id, _endpoint, fn) =>
      id == null ? fn() : auth.withProperty(client, id, fn)
    ),
  }
  return auth
}

describe('CustosErp.getCustosAtivos', () => {
  it('chama selectProperty antes do POST', async () => {
    const client = makeClient()
    const auth = makeAuth()
    await new CustosErp(client, auth).getCustosAtivos({
      propertyId: 10,
      referenceDate: '2026-06-30',
    })
    expect(auth.selectProperty).toHaveBeenCalledWith(client, 10)
  })

  it('envia body com propriedade e data (último dia do mês)', async () => {
    const client = makeClient()
    const auth = makeAuth()
    await new CustosErp(client, auth).getCustosAtivos({
      propertyId: 10,
      referenceDate: '2026-06-30',
    })
    expect(client.post).toHaveBeenCalledWith(
      '/custoporanimal/exportacao-custos-animais-ativos-erp-v2/',
      { propriedade: 10, data: '2026-06-30' },
      { timeoutMs: 300_000 }
    )
  })

  it('inclui data_inicio quando fromDate informado', async () => {
    const client = makeClient()
    const auth = makeAuth()
    await new CustosErp(client, auth).getCustosAtivos({
      propertyId: 10,
      referenceDate: '2026-06-30',
      fromDate: '2026-01-01',
    })
    expect(client.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ data_inicio: '2026-01-01' }),
      { timeoutMs: 300_000 }
    )
  })

  it('retorna o array de dados do envelope { dados: [...] }', async () => {
    const result = await new CustosErp(makeClient(), makeAuth()).getCustosAtivos({
      propertyId: 10,
      referenceDate: '2026-06-30',
    })
    expect(result).toHaveLength(1)
    expect(result[0].valor).toBe(6972.28)
  })

  it('retorna a resposta bruta quando não vem envelopada em { dados }', async () => {
    const result = await new CustosErp(makeClient(DADOS), makeAuth()).getCustosAtivos({
      propertyId: 10,
      referenceDate: '2026-06-30',
    })
    expect(result).toEqual(DADOS)
  })

  it('lança ValidationError sem propertyId/referenceDate', async () => {
    const custos = new CustosErp(makeClient(), makeAuth())
    await expect(custos.getCustosAtivos({ propertyId: 10 })).rejects.toBeInstanceOf(ValidationError)
    await expect(custos.getCustosAtivos()).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('CustosErp.getCustosVendidos', () => {
  it('envia propriedade, data_inicio e data_fim', async () => {
    const client = makeClient()
    const auth = makeAuth()
    await new CustosErp(client, auth).getCustosVendidos({
      propertyId: 10,
      from: '2026-01-01',
      to: '2026-06-30',
    })
    expect(client.post).toHaveBeenCalledWith(
      '/custoporanimal/exportacao-custos-animais-vendidos-erp-v2/',
      { propriedade: 10, data_inicio: '2026-01-01', data_fim: '2026-06-30' },
      { timeoutMs: 300_000 }
    )
  })

  it('retorna o array de dados do envelope { dados: [...] }', async () => {
    const client = makeClient()
    const auth = makeAuth()
    const result = await new CustosErp(client, auth).getCustosVendidos({
      propertyId: 10,
      from: '2026-01-01',
      to: '2026-06-30',
    })
    expect(result).toEqual(DADOS)
  })

  it('retorna a resposta bruta quando não vem envelopada em { dados }', async () => {
    const client = makeClient(DADOS) // sem envelope { dados: ... }
    const auth = makeAuth()
    const result = await new CustosErp(client, auth).getCustosVendidos({
      propertyId: 10,
      from: '2026-01-01',
      to: '2026-06-30',
    })
    expect(result).toEqual(DADOS)
  })

  it('lança ValidationError sem propertyId/from/to', async () => {
    const custos = new CustosErp(makeClient(), makeAuth())
    await expect(custos.getCustosVendidos({ propertyId: 10 })).rejects.toBeInstanceOf(
      ValidationError
    )
  })
})

describe('CustosErp.getCustosMortos', () => {
  it('envia body correto para o endpoint de mortos', async () => {
    const client = makeClient()
    const auth = makeAuth()
    await new CustosErp(client, auth).getCustosMortos({
      propertyId: 10,
      from: '2026-01-01',
      to: '2026-06-30',
    })
    expect(client.post).toHaveBeenCalledWith(
      '/custoporanimal/exportacao-custos-animais-mortos-erp-v2/',
      { propriedade: 10, data_inicio: '2026-01-01', data_fim: '2026-06-30' },
      { timeoutMs: 300_000 }
    )
  })

  it('retorna a resposta bruta quando não vem envelopada em { dados }', async () => {
    const client = makeClient(DADOS)
    const auth = makeAuth()
    const result = await new CustosErp(client, auth).getCustosMortos({
      propertyId: 10,
      from: '2026-01-01',
      to: '2026-06-30',
    })
    expect(result).toEqual(DADOS)
  })

  it('lança ValidationError sem propertyId/from/to', async () => {
    const custos = new CustosErp(makeClient(), makeAuth())
    await expect(custos.getCustosMortos({ propertyId: 10 })).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('CustosErp.getSaldoBiologico', () => {
  it('chama selectProperty e POST com dia 01', async () => {
    const client = makeClient({ dados: { vivos: {}, mortos: {}, vendidos: {} } })
    const auth = makeAuth()
    await new CustosErp(client, auth).getSaldoBiologico({
      propertyId: 10,
      referenceDate: '2026-06-01',
    })
    expect(auth.selectProperty).toHaveBeenCalledWith(client, 10)
    expect(client.post).toHaveBeenCalledWith(
      '/custoporanimal/saldo-ativo-biologico-erp/',
      {
        propriedade: 10,
        data: '2026-06-01',
      },
      { timeoutMs: 300_000 }
    )
  })

  it('omite propriedade e NÃO chama selectProperty quando propertyId ausente', async () => {
    const client = makeClient({ dados: {} })
    const auth = makeAuth()
    await new CustosErp(client, auth).getSaldoBiologico({ referenceDate: '2026-06-01' })
    expect(auth.selectProperty).not.toHaveBeenCalled()
    // Sem propertyId o endpoint vale para o contrato: não exige fazenda selecionada.
    expect(auth.inProperty).toHaveBeenCalledWith(
      client,
      undefined,
      expect.any(String),
      expect.any(Function),
      { requireSelection: false }
    )
    expect(client.post).toHaveBeenCalledWith(
      '/custoporanimal/saldo-ativo-biologico-erp/',
      {
        data: '2026-06-01',
      },
      { timeoutMs: 300_000 }
    )
  })

  it('retorna a resposta bruta quando não vem envelopada em { dados }', async () => {
    const saldo = { vivos: {}, mortos: {}, vendidos: {} }
    const client = makeClient(saldo)
    const auth = makeAuth()
    const result = await new CustosErp(client, auth).getSaldoBiologico({
      propertyId: 10,
      referenceDate: '2026-06-01',
    })
    expect(result).toEqual(saldo)
  })

  it('lança ValidationError sem referenceDate', async () => {
    const custos = new CustosErp(makeClient(), makeAuth())
    await expect(custos.getSaldoBiologico({ propertyId: 10 })).rejects.toBeInstanceOf(
      ValidationError
    )
    await expect(custos.getSaldoBiologico()).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('CustosErp.sendCustoIndireto', () => {
  it('hardcoda conta -2 e envia mes_referencia + valor', async () => {
    const client = { post: vi.fn().mockResolvedValue([]) }
    const auth = makeAuth()
    await new CustosErp(client, auth).sendCustoIndireto({
      propertyId: 10,
      referenceMonth: '2026-06-01',
      amount: 5000,
    })
    expect(client.post).toHaveBeenCalledWith(
      '/custoporanimal/custo-indireto-erp/',
      {
        propriedade: 10,
        mes_referencia: '2026-06-01',
        valor: 5000,
        conta: -2,
      },
      { timeoutMs: 300_000 }
    )
  })

  it('omite propriedade quando propertyId ausente (rateia no contrato inteiro)', async () => {
    const client = { post: vi.fn().mockResolvedValue([]) }
    const auth = makeAuth()
    await new CustosErp(client, auth).sendCustoIndireto({
      referenceMonth: '2026-06-01',
      amount: 1000,
    })
    const body = client.post.mock.calls[0][1]
    expect(body.propriedade).toBeUndefined()
    expect(body.conta).toBe(-2)
  })

  it('lança ValidationError sem referenceMonth/amount', async () => {
    const custos = new CustosErp(makeClient(), makeAuth())
    await expect(custos.sendCustoIndireto({ propertyId: 10 })).rejects.toBeInstanceOf(
      ValidationError
    )
    await expect(custos.sendCustoIndireto()).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('CustosErp.getSaidasMaterial', () => {
  it('envia tipo_saida e data corretos', async () => {
    const client = { post: vi.fn().mockResolvedValue({ dados: [] }) }
    const auth = makeAuth()
    await new CustosErp(client, auth).getSaidasMaterial({
      propertyId: 10,
      date: '2026-06-15',
      tipoSaida: TIPO_SAIDA_MATERIAL.TRATAMENTO_ANIMAIS,
    })
    expect(client.post).toHaveBeenCalledWith(
      '/movimentacaomaterial/buscar-saidas/',
      {
        propriedade: 10,
        data: '2026-06-15',
        tipo_saida: 25,
      },
      { timeoutMs: 300_000 }
    )
  })

  it('retorna a resposta bruta quando não vem envelopada em { dados }', async () => {
    const rows = [{ id: 1, valor: 500 }]
    const client = { post: vi.fn().mockResolvedValue(rows) }
    const auth = makeAuth()
    const result = await new CustosErp(client, auth).getSaidasMaterial({
      propertyId: 10,
      date: '2026-06-15',
      tipoSaida: TIPO_SAIDA_MATERIAL.TRATAMENTO_ANIMAIS,
    })
    expect(result).toEqual(rows)
  })

  it('omite propriedade e NÃO chama selectProperty quando propertyId ausente', async () => {
    const client = { post: vi.fn().mockResolvedValue({ dados: [] }) }
    const auth = makeAuth()
    await new CustosErp(client, auth).getSaidasMaterial({
      date: '2026-06-15',
      tipoSaida: TIPO_SAIDA_MATERIAL.TRATAMENTO_ANIMAIS,
    })
    expect(auth.selectProperty).not.toHaveBeenCalled()
    expect(client.post).toHaveBeenCalledWith(
      '/movimentacaomaterial/buscar-saidas/',
      {
        data: '2026-06-15',
        tipo_saida: 25,
      },
      { timeoutMs: 300_000 }
    )
  })

  it('lança ValidationError sem data/tipoSaida', async () => {
    const custos = new CustosErp(makeClient(), makeAuth())
    await expect(custos.getSaidasMaterial({ propertyId: 10 })).rejects.toBeInstanceOf(
      ValidationError
    )
    await expect(custos.getSaidasMaterial()).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('CustosErp: POST com corpo vazio', () => {
  it.each([
    ['getCustosAtivos', { propertyId: 10, referenceDate: '2026-06-30' }],
    ['getCustosVendidos', { propertyId: 10, from: '2026-06-01', to: '2026-06-30' }],
    ['getCustosMortos', { propertyId: 10, from: '2026-06-01', to: '2026-06-30' }],
    ['getSaldoBiologico', { referenceDate: '2026-06-01' }],
    ['getSaidasMaterial', { date: '2026-06-01', tipoSaida: 2 }],
  ])('%s devolve null em vez de TypeError', async (method, args) => {
    const custos = new CustosErp(makeClient(null), makeAuth())
    await expect(custos[method](args)).resolves.toBeNull()
  })

  it('propertyId null conta como "sem fazenda" (não tenta selecionar)', async () => {
    const auth = makeAuth()
    const client = makeClient()
    await new CustosErp(client, auth).getSaldoBiologico({
      propertyId: null,
      referenceDate: '2026-06-01',
    })
    expect(auth.selectProperty).not.toHaveBeenCalled()
    expect(client.post.mock.calls[0][1]).toEqual({ data: '2026-06-01' })
  })
})
