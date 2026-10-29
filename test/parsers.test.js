import { describe, it, expect } from 'vitest'
import {
  parseBrNumber,
  parseBrDate,
  parseErpRecord,
  parseErpPage,
  countCalendarDays,
} from '../src/parsers.js'
import { ValidationError } from '../src/errors.js'

describe('parseBrNumber', () => {
  it('converte número BR simples', () => expect(parseBrNumber('1.234,56')).toBe(1234.56))
  it('converte zero', () => expect(parseBrNumber('0,00')).toBe(0))
  it('converte sem milhar', () => expect(parseBrNumber('42,5')).toBe(42.5))
  it('não altera string não-BR', () => expect(parseBrNumber('hello')).toBe('hello'))
  it('não altera número nativo', () => expect(parseBrNumber(123)).toBe(123))
  it('não altera null', () => expect(parseBrNumber(null)).toBe(null))

  describe('limite conhecido (documentado, não é bug)', () => {
    it('inteiro ≥ 1000 SEM separador de milhar não é reconhecido como BR', () => {
      // A API MultBovinos sempre envia o separador ("1.234"), nunca "1234" —
      // confirmado em todos os endpoints testados. Se isso mudasse, o
      // valor voltaria como string em vez de number; documentado aqui para
      // que uma mudança futura na API apareça como falha clara deste teste,
      // não como um bug silencioso em produção.
      expect(parseBrNumber('1234')).toBe('1234')
    })
  })

  // Só a pontuação BR (vírgula decimal ou milhar) identifica um número: um
  // inteiro sem pontuação é código (brinco, curral) e não perde o zero.
  it.each([
    ['045', '045'],
    ['01', '01'],
    ['1045', '1045'],
    ['12', '12'],
    ['1.045', 1045],
    ['12,5', 12.5],
    ['1.234.567,89', 1234567.89],
    ['12.34', '12.34'],
    ['1,', '1,'],
  ])('%s → %o', (input, expected) => expect(parseBrNumber(input)).toBe(expected))
})

describe('parseBrDate', () => {
  it('converte data BR', () => expect(parseBrDate('25/06/2026')).toBe('2026-06-25'))
  it('não altera ISO', () => expect(parseBrDate('2026-06-25')).toBe('2026-06-25'))
  it('não altera string aleatória', () => expect(parseBrDate('foo')).toBe('foo'))
  it('não altera null', () => expect(parseBrDate(null)).toBe(null))
})

describe('parseErpRecord', () => {
  it('converte campos aninhados', () => {
    const input = { valor: '1.000,00', data: '01/01/2026', nome: 'Fazenda' }
    expect(parseErpRecord(input)).toEqual({ valor: 1000, data: '2026-01-01', nome: 'Fazenda' })
  })

  it('percorre arrays recursivamente', () => {
    const input = [{ v: '10,5' }, { v: '0,00' }]
    expect(parseErpRecord(input)).toEqual([{ v: 10.5 }, { v: 0 }])
  })

  it('não toca em campos que não são BR', () => {
    const input = { id: 1, ativo: true, nome: 'teste' }
    expect(parseErpRecord(input)).toEqual({ id: 1, ativo: true, nome: 'teste' })
  })
})

describe('parseErpPage', () => {
  it('converte results e preserva count/links', () => {
    const page = {
      count: 2,
      links: { next: null },
      results: [{ v: '1,00' }, { v: '2,50' }],
    }
    const out = parseErpPage(page)
    expect(out.count).toBe(2)
    expect(out.links).toEqual({ next: null })
    expect(out.results).toEqual([{ v: 1 }, { v: 2.5 }])
  })

  it('retorna page intacta se não tiver results', () => {
    const page = { dados: [] }
    expect(parseErpPage(page)).toEqual({ dados: [] })
  })
})

describe('parseBrDate: só datas que existem', () => {
  it.each([
    ['31/02/2026', '31/02/2026'],
    ['29/02/2025', '29/02/2025'],
    ['00/01/2026', '00/01/2026'],
    ['15/13/2026', '15/13/2026'],
    ['29/02/2024', '2024-02-29'],
    ['31/12/2026', '2026-12-31'],
  ])('%s → %s', (input, expected) => expect(parseBrDate(input)).toBe(expected))
})

describe('parseErpRecord: campos que nunca são convertidos', () => {
  it('*_texto, *_usual e identificadores ficam como vieram; o resto converte', () => {
    const r = parseErpRecord({
      identificacao_usual: '1.045',
      animal_id_usual: '12,5',
      localidade_texto: '1.234,00',
      sisbov: '1.234',
      documento: '1.000',
      codigo: '01/02/2026',
      valor: '1.234,50',
      data: '01/02/2026',
      curral: '045',
      aninhado: { lote_texto: '2,5', peso: '2,5' },
    })
    expect(r).toEqual({
      identificacao_usual: '1.045',
      animal_id_usual: '12,5',
      localidade_texto: '1.234,00',
      sisbov: '1.234',
      documento: '1.000',
      codigo: '01/02/2026',
      valor: 1234.5,
      data: '2026-02-01',
      curral: '045',
      aninhado: { lote_texto: '2,5', peso: 2.5 },
    })
  })

  it('lista.map(parseErpRecord) continua funcionando (o índice não é nome de campo)', () => {
    expect(['1.234,5', '045', '02/01/2026'].map(parseErpRecord)).toEqual([
      1234.5,
      '045',
      '2026-01-02',
    ])
  })
})

describe('countCalendarDays', () => {
  it.each([
    ['01/06/2026', '2026-06-30', 'from'],
    ['2026-06-01', '2026-02-30', 'to'],
    ['2026-6-1', '2026-06-30', 'from'],
    [undefined, '2026-06-30', 'from'],
  ])('data inválida (%s, %s) → ValidationError em %s', (from, to, field) => {
    let err
    try {
      countCalendarDays(from, to)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.field).toBe(field)
  })

  it('janeiro completo = 31 dias (não 30)', () =>
    expect(countCalendarDays('2026-01-01', '2026-01-31')).toBe(31))

  it('1 único dia = 1', () => expect(countCalendarDays('2026-06-01', '2026-06-01')).toBe(1))

  it('fevereiro bissexto 2024 = 29', () =>
    expect(countCalendarDays('2024-02-01', '2024-02-29')).toBe(29))

  it('janela de 31 dias não rejeita (= 31, não > 31)', () =>
    expect(countCalendarDays('2026-06-01', '2026-06-30')).toBeLessThanOrEqual(31))
})

describe('números negativos BR', () => {
  it.each([
    ['-1,5', -1.5],
    ['-1.234,56', -1234.56],
    ['-1.045', -1045],
    ['-045', '-045'],
    ['-12', '-12'],
  ])('%s → %o', (input, expected) => expect(parseBrNumber(input)).toBe(expected))
})
