// Leitura em fluxo de um corpo JSON no formato { ..., "<campo>": [ {...}, ... ] }
// (interno). Cada objeto da lista é entregue em lotes, assim que chega, sem
// guardar o corpo inteiro nem a lista inteira na memória: um rebanho grande no
// BI vem num único JSON de dezenas de MB, e o JSON.parse dele inteiro passa de
// centenas de MB.
//
// Só a estrutura é varrida (chaves, colchetes, aspas e escapes); cada objeto da
// lista vai para o JSON.parse nativo, então os valores saem idênticos aos do
// parse do corpo inteiro.
//
// Quando o corpo não tem a lista (não começa com "{", ou não há o campo), não
// há o que entregar: devolve o começo do corpo (até headLimit caracteres) para
// quem chamou classificar a resposta como de costume ({ detail }, HTML de erro,
// envelope sem registros).
import { InvalidResponseError } from './errors.js'

const QUOTE = 34 // "
const BACKSLASH = 92 // \
const COMMA = 44 // ,
const OPEN_OBJ = 123 // {
const CLOSE_OBJ = 125 // }
const OPEN_ARR = 91 // [
const CLOSE_ARR = 93 // ]

const isSpace = (c) => c === 32 || c === 9 || c === 10 || c === 13

export const HEAD_LIMIT = 65_536

// chunks: iterável assíncrono de Uint8Array (o res.body do fetch).
// onBatch(items): chamado com cada lote de até batchSize objetos, e esperado
// antes de ler o resto (o ritmo é o de quem consome).
// Devolve { found: true, count } ou { found: false, text }.
export async function streamJsonArray(chunks, { field, batchSize, onBatch, slug }) {
  const decoder = new TextDecoder()
  let mode = 'start' // start → struct (corpo com "{") | raw (outro formato)
  let head = ''
  let depth = 0
  let inString = false
  let escaped = false
  let expectKey = false
  let keyBuf = null // chave de 1º nível sendo lida (null: não está lendo)
  let lastKey = null
  let target = 0 // 0: lista não achada; 1: dentro dela; 2: lista terminada
  let pending = '' // começo do objeto atual que veio em pedaço anterior
  let elemStart = -1 // início do objeto atual no pedaço corrente
  let batch = []
  let count = 0

  const fail = (message) =>
    new InvalidResponseError(`${message} (leitura em fluxo de "${field}")`, { slug })

  const parse = (json, what) => {
    try {
      return JSON.parse(json)
    } catch (err) {
      throw new InvalidResponseError(`${what} inválido (leitura em fluxo de "${field}")`, {
        slug,
        cause: err,
      })
    }
  }

  const flush = async () => {
    if (batch.length === 0) return
    const items = batch
    batch = []
    await onBatch(items)
  }

  const scan = async (text) => {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i)
      if (mode === 'start') {
        if (isSpace(c)) continue
        mode = c === OPEN_OBJ ? 'struct' : 'raw'
        if (mode === 'raw') return
      }
      if (inString) {
        if (escaped) escaped = false
        else if (c === BACKSLASH) escaped = true
        else if (c === QUOTE) {
          inString = false
          if (keyBuf !== null) {
            lastKey = parse(`"${keyBuf}"`, 'nome de campo')
            keyBuf = null
            expectKey = false
            continue
          }
        }
        if (keyBuf !== null) keyBuf += text[i]
        continue
      }
      if (c === QUOTE) {
        inString = true
        if (depth === 1 && expectKey) keyBuf = ''
        continue
      }
      if (target === 1 && depth === 2) {
        // Entre os elementos da lista: só objetos, vírgulas e o fim dela.
        if (c === OPEN_OBJ) {
          elemStart = i
          depth = 3
        } else if (c === CLOSE_ARR) {
          depth = 1
          target = 2
          await flush()
        } else if (c !== COMMA && !isSpace(c)) {
          throw fail('elemento da lista não é um objeto')
        }
        continue
      }
      if (c === OPEN_OBJ || c === OPEN_ARR) {
        if (depth === 1 && c === OPEN_ARR && target === 0 && lastKey === field) {
          target = 1
          head = ''
        }
        depth++
        if (depth === 1) expectKey = true
      } else if (c === CLOSE_OBJ || c === CLOSE_ARR) {
        depth--
        if (target === 1 && depth === 2) {
          const json = pending + text.slice(elemStart, i + 1)
          pending = ''
          elemStart = -1
          batch.push(parse(json, 'objeto da lista'))
          count++
          if (batch.length >= batchSize) await flush()
        }
      } else if (c === COMMA && depth === 1) {
        expectKey = true
      }
    }
    // O objeto atual continua no próximo pedaço.
    if (elemStart >= 0) {
      pending += text.slice(elemStart)
      elemStart = 0
    }
  }

  const feed = async (text) => {
    if (target === 0 && head.length < HEAD_LIMIT) head += text.slice(0, HEAD_LIMIT - head.length)
    if (mode !== 'raw') await scan(text)
  }

  for await (const chunk of chunks) {
    await feed(decoder.decode(chunk, { stream: true }))
    if (mode === 'raw' && head.length >= HEAD_LIMIT) break
  }
  await feed(decoder.decode())

  if (target === 0) return { found: false, text: head }
  if (target === 1 || depth !== 0 || inString) throw fail('corpo JSON incompleto')
  return { found: true, count }
}
