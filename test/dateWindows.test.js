import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ValidationError } from '../src/errors.js'
import { countCalendarDays, parseBrDate } from '../src/parsers.js'
import {
  getWeeklyWindows,
  getMonthlyWindows,
  lastDayOfMonth,
  firstDayOfMonth,
} from '../src/helpers/dateWindows.js'

describe('getWeeklyWindows', () => {
  it('produz janelas de 7 dias', () => {
    const w = getWeeklyWindows('2026-04-01', '2026-04-14')
    expect(w).toHaveLength(2)
    expect(w[0]).toEqual({ from: '2026-04-01', to: '2026-04-07' })
    expect(w[1]).toEqual({ from: '2026-04-08', to: '2026-04-14' })
  })

  it('última janela é cortada no to quando não fecha exato', () => {
    const w = getWeeklyWindows('2026-04-01', '2026-04-10')
    expect(w).toHaveLength(2)
    expect(w[0]).toEqual({ from: '2026-04-01', to: '2026-04-07' })
    expect(w[1]).toEqual({ from: '2026-04-08', to: '2026-04-10' })
  })

  it('from === to retorna uma única janela de um dia', () => {
    const w = getWeeklyWindows('2026-06-26', '2026-06-26')
    expect(w).toHaveLength(1)
    expect(w[0]).toEqual({ from: '2026-06-26', to: '2026-06-26' })
  })

  it('aceita days customizado', () => {
    const w = getWeeklyWindows('2026-04-01', '2026-04-30', 30)
    expect(w).toHaveLength(1)
    expect(w[0]).toEqual({ from: '2026-04-01', to: '2026-04-30' })
  })

  it('90 dias gera 13 janelas', () => {
    const w = getWeeklyWindows('2026-03-28', '2026-06-25')
    expect(w).toHaveLength(13)
    expect(w[0].from).toBe('2026-03-28')
    expect(w[12].to).toBe('2026-06-25')
  })
})

describe('getMonthlyWindows', () => {
  it('produz janelas mensais corretas', () => {
    const w = getMonthlyWindows('2026-01-01', '2026-03-31')
    expect(w).toHaveLength(3)
    expect(w[0]).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(w[1]).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(w[2]).toEqual({ from: '2026-03-01', to: '2026-03-31' })
  })

  it('from no meio do mês preserva data inicial', () => {
    const w = getMonthlyWindows('2026-01-15', '2026-02-28')
    expect(w[0].from).toBe('2026-01-15')
    expect(w[0].to).toBe('2026-01-31')
  })
})

describe('lastDayOfMonth', () => {
  it('retorna o último dia de um mês de 30 dias', () => {
    expect(lastDayOfMonth('2026-06')).toBe('2026-06-30')
  })

  it('retorna o último dia de um mês de 31 dias', () => {
    expect(lastDayOfMonth('2026-07')).toBe('2026-07-31')
  })

  it('respeita ano bissexto em fevereiro', () => {
    expect(lastDayOfMonth('2024-02')).toBe('2024-02-29')
  })

  it('fevereiro em ano não-bissexto', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28')
  })
})

describe('firstDayOfMonth', () => {
  it('retorna o dia 01 do mês informado', () => {
    expect(firstDayOfMonth('2026-06')).toBe('2026-06-01')
  })
})

describe('validação das entradas', () => {
  const captureError = (fn) => {
    try {
      fn()
    } catch (e) {
      return e
    }
  }

  it.each([0, -1, 1.5, Number.NaN])(
    'getWeeklyWindows com days = %s lança (antes: laço infinito)',
    (days) => {
      const err = captureError(() => getWeeklyWindows('2026-01-01', '2026-01-31', days))
      expect(err).toBeInstanceOf(ValidationError)
      expect(err.field).toBe('days')
    }
  )

  it.each([
    [() => getWeeklyWindows('01/01/2026', '2026-01-31'), 'from'],
    [() => getWeeklyWindows('2026-01-01', '2026-02-30'), 'to'],
    [() => getMonthlyWindows('2026-13-01', '2026-12-31'), 'from'],
    [() => getMonthlyWindows('2026-01-01', 'ontem'), 'to'],
  ])('data inválida lança ValidationError (%#)', (fn, field) => {
    const err = captureError(fn)
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.field).toBe(field)
  })

  it.each(['2026-13', '2026-00', '2026-6', '06/2026', undefined])(
    'lastDayOfMonth/firstDayOfMonth(%s) lança ValidationError',
    (ym) => {
      expect(captureError(() => lastDayOfMonth(ym))).toBeInstanceOf(ValidationError)
      expect(captureError(() => firstDayOfMonth(ym))).toBeInstanceOf(ValidationError)
    }
  )

  it('from depois de to devolve lista vazia', () => {
    expect(getWeeklyWindows('2026-02-01', '2026-01-01')).toEqual([])
    expect(getMonthlyWindows('2026-02-01', '2026-01-01')).toEqual([])
  })
})

// As janelas usam meia-noite LOCAL: o resultado não pode depender do fuso
// da máquina — inclusive num fuso com horário de verão (Nova York muda em
// 2026-03-08) e no de Brasília.
describe.each(['UTC', 'America/Sao_Paulo', 'America/New_York', 'Asia/Tokyo'])('fuso %s', (tz) => {
  const original = process.env.TZ
  beforeAll(() => {
    process.env.TZ = tz
  })
  afterAll(() => {
    // process.env só guarda texto: atribuir undefined gravaria "undefined"
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  it('o fuso do processo foi trocado de fato', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz)
  })

  it('janelas semanais atravessando a troca de horário', () => {
    expect(getWeeklyWindows('2026-03-02', '2026-03-15')).toEqual([
      { from: '2026-03-02', to: '2026-03-08' },
      { from: '2026-03-09', to: '2026-03-15' },
    ])
  })

  it('janelas mensais e último dia do mês', () => {
    expect(getMonthlyWindows('2026-02-10', '2026-03-31')).toEqual([
      { from: '2026-02-10', to: '2026-02-28' },
      { from: '2026-03-01', to: '2026-03-31' },
    ])
    expect(lastDayOfMonth('2024-02')).toBe('2024-02-29')
  })

  it('contagem de dias e parse de data BR', () => {
    expect(countCalendarDays('2026-03-01', '2026-03-31')).toBe(31)
    expect(parseBrDate('08/03/2026')).toBe('2026-03-08')
  })
})
