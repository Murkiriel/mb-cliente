import { MS_PER_DAY, isoToUtc, isRealDate } from './dates.js'

// Número BR só é reconhecido pela pontuação: vírgula decimal ("12,5",
// "1.234,56") ou separador de milhar ("1.234"). Um inteiro sem pontuação
// ("045", "01", "1045") fica string — antes "045" virava 45 e "1045" ficava
// string, então um brinco ou curral perdia o zero à esquerda e a mesma coluna
// misturava número e texto. A API sempre envia o separador quando o valor é
// ≥ 1000 (docs/api.md), então um inteiro sem pontuação é, na prática,
// um código. Negativos ("-1,5", "-1.234,56") também são reconhecidos.
const BR_NUMBER_RE = /^-?\d{1,3}(?:(?:\.\d{3})*,\d+|(?:\.\d{3})+)$/
const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const BR_DATETIME_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/

// Campos que nunca são convertidos, mesmo que pareçam número/data: rótulos
// (*_texto), identificações do animal (*_usual) e documentos/códigos.
const RAW_SUFFIXES = ['_texto', '_usual']
const RAW_KEYS = new Set([
  'identificacao',
  'sisbov',
  'codigo',
  'documento',
  'cpf',
  'cnpj',
  'cep',
  'telefone',
  'celular',
  'ordem_servico',
])

function keepRaw(key) {
  return RAW_KEYS.has(key) || RAW_SUFFIXES.some((s) => key.endsWith(s))
}

export function parseBrNumber(value) {
  if (typeof value !== 'string' || !BR_NUMBER_RE.test(value)) return value
  return parseFloat(value.replace(/\./g, '').replace(',', '.'))
}

// Só converte datas que existem no calendário: "31/02/2026" fica como veio.
export function parseBrDate(value) {
  const m = typeof value === 'string' ? BR_DATE_RE.exec(value) : null
  if (!m || !isRealDate(+m[3], +m[2], +m[1])) return value
  return `${m[3]}-${m[2]}-${m[1]}`
}

// Data e hora BR ("DD/MM/YYYY HH:MM[:SS]", como em tratos e movimentações) →
// "YYYY-MM-DD HH:MM[:SS]", hora local do servidor, sem fuso. Data ou hora
// inexistente e qualquer outro valor voltam como vieram. Não é aplicada
// automaticamente pelo parse do ERP: o formato com hora varia por endpoint.
export function parseBrDateTime(value) {
  const m = typeof value === 'string' ? BR_DATETIME_RE.exec(value) : null
  if (!m || !isRealDate(+m[3], +m[2], +m[1])) return value
  if (+m[4] > 23 || +m[5] > 59 || (m[6] !== undefined && +m[6] > 59)) return value
  const time = m[6] === undefined ? `${m[4]}:${m[5]}` : `${m[4]}:${m[5]}:${m[6]}`
  return `${m[3]}-${m[2]}-${m[1]} ${time}`
}

export function parseErpRecord(record, key) {
  if (Array.isArray(record)) return record.map((v) => parseErpRecord(v))
  if (record !== null && typeof record === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(record)) {
      out[k] = parseErpRecord(v, k)
    }
    return out
  }
  if (typeof record !== 'string') return record
  // Converte primeiro: quase nenhuma string muda, e só quando muda vale
  // perguntar se o campo é dos que ficam crus. key só existe para valores de
  // campo de objeto (um índice de array — ex.: `lista.map(parseErpRecord)` —
  // não é nome de campo).
  const converted = parseBrDate(parseBrNumber(record))
  return converted !== record && typeof key === 'string' && keepRaw(key) ? record : converted
}

export function parseErpPage(page) {
  if (!page || !Array.isArray(page.results)) return page
  return { ...page, results: page.results.map(parseErpRecord) }
}

// Contagem de dias corridos inclusiva: '2026-01-01' → '2026-01-31' = 31 (não 30).
// Datas fora do formato YYYY-MM-DD, ou inexistentes, lançam ValidationError —
// antes viravam NaN, que passava em qualquer checagem "entre 1 e 31".
export function countCalendarDays(from, to) {
  const diff = isoToUtc(to, 'to') - isoToUtc(from, 'from')
  return Math.round(diff / MS_PER_DAY) + 1
}
