// Datas ISO internas do SDK (fora do mapa de exports: não é API pública).
import { ValidationError } from './errors.js'

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/

export const MS_PER_DAY = 86_400_000

// 'YYYY-MM-DD' válido → timestamp UTC; qualquer outra coisa → ValidationError.
export function isoToUtc(value, field) {
  const m = typeof value === 'string' ? ISO_DATE_RE.exec(value) : null
  if (!m || !isRealDate(+m[1], +m[2], +m[3])) {
    throw new ValidationError(`${field} deve ser uma data válida no formato YYYY-MM-DD`, {
      field,
      received: value,
    })
  }
  return Date.UTC(+m[1], +m[2] - 1, +m[3])
}

// 'YYYY-MM' com mês de 01 a 12 → [ano, mês]; qualquer outra coisa → ValidationError.
export function parseYearMonth(yearMonth) {
  const match = typeof yearMonth === 'string' ? YEAR_MONTH_RE.exec(yearMonth) : null
  if (!match || +match[2] < 1 || +match[2] > 12) {
    throw new ValidationError('yearMonth deve estar no formato YYYY-MM (mês de 01 a 12)', {
      field: 'yearMonth',
      received: yearMonth,
    })
  }
  return [+match[1], +match[2]]
}

export function isRealDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}
