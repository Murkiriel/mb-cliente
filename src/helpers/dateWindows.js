import { isoToUtc, parseYearMonth } from '../dates.js'
import { checkPositiveInt } from '../validate.js'

// Gera array de janelas de N dias entre duas datas (inclusive ambas as pontas).
// getWeeklyWindows('2026-03-28', '2026-04-10')
//   → [{ from:'2026-03-28', to:'2026-04-03' },
//      { from:'2026-04-04', to:'2026-04-10' }]
//
// days precisa ser inteiro ≥ 1 (com 0 a janela nunca avançava e o array
// crescia até estourar a memória); from/to precisam ser datas YYYY-MM-DD.
export function getWeeklyWindows(from, to, days = 7) {
  checkPositiveInt(days, 'days')
  let winStart = _parse(from, 'from')
  const end = _parse(to, 'to')
  const windows = []

  while (winStart <= end) {
    const winEnd = new Date(winStart)
    winEnd.setDate(winEnd.getDate() + days - 1)

    windows.push({
      from: _fmt(winStart),
      to: _fmt(winEnd < end ? winEnd : end),
    })

    winStart = new Date(winEnd)
    winStart.setDate(winStart.getDate() + 1)
  }

  return windows
}

// Gera array de janelas mensais entre duas datas (inclusive ambas as pontas).
// getMonthlyWindows('2023-01-01', '2023-03-31')
//   → [{ from:'2023-01-01', to:'2023-01-31' },
//      { from:'2023-02-01', to:'2023-02-28' },
//      { from:'2023-03-01', to:'2023-03-31' }]
export function getMonthlyWindows(from, to) {
  const fromDate = _parse(from, 'from')
  const end = _parse(to, 'to')
  const windows = []
  let current = fromDate // nunca alterado no lugar: cada passo cria uma data nova

  while (current <= end) {
    const year = current.getFullYear()
    const month = current.getMonth()

    const windowStart = new Date(year, month, 1)
    const windowEnd = new Date(year, month + 1, 0) // último dia do mês

    windows.push({
      from: _fmt(windowStart > fromDate ? windowStart : fromDate),
      to: _fmt(windowEnd < end ? windowEnd : end),
    })

    current = new Date(year, month + 1, 1)
  }

  return windows
}

// Último dia do mês. Em custos, só para um mês já fechado: a referenceDate
// nunca pode estar no futuro (estoura o prazo ou devolve HTTP 400).
// lastDayOfMonth('2026-06') → '2026-06-30'
// lastDayOfMonth('2026-02') → '2026-02-28' (ou 29 em bissexto)
export function lastDayOfMonth(yearMonth) {
  const [y, m] = parseYearMonth(yearMonth)
  const d = new Date(y, m, 0)
  return _fmt(d)
}

// Primeiro dia do mês — para saldo biológico (CPC 29)
// firstDayOfMonth('2026-06') → '2026-06-01'
export function firstDayOfMonth(yearMonth) {
  const [y, m] = parseYearMonth(yearMonth)
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
}

// Valida 'YYYY-MM-DD' (ValidationError citando field) e devolve a data como
// meia-noite LOCAL (evita o erro de um dia do UTC em fusos negativos).
function _parse(s, field) {
  isoToUtc(s, field)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function _fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
