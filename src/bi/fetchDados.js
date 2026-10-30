import { ValidationError } from '../errors.js'
import { checkPositiveInt } from '../validate.js'
import { callOptions } from '../callOptions.js'

// Leitura comum dos endpoints BI (interno): toda resposta vem no envelope
// { dados: [...] } — ausente quando não há registros — e vira { items, count }.
// query undefined → GET sem parâmetros (os cadastros e os por fazenda sem
// filtro de data). timeoutMs: prazo só desta chamada (padrão: o da instância).
export async function getDados(client, slug, query, { timeoutMs } = {}) {
  const path = `/integracaobi/${slug}`
  let request
  if (timeoutMs !== undefined) request = client.get(path, query ?? {}, { timeoutMs })
  else request = query === undefined ? client.get(path) : client.get(path, query)
  const data = await request
  const items = data.dados ?? []
  return { items, count: items.length }
}

// Lotes padrão da leitura em fluxo: grandes o bastante para gravar em lote,
// pequenos o bastante para a memória não depender do tamanho da fazenda.
export const DEFAULT_BATCH_SIZE = 1000

// Valida as opções da leitura em fluxo ANTES de entrar na fila da fazenda
// (uma opção errada não chega a trocar a fazenda no servidor).
export function streamOptions({ timeoutMs, batchSize = DEFAULT_BATCH_SIZE } = {}, onBatch) {
  if (typeof onBatch !== 'function') {
    throw new ValidationError('onBatch deve ser uma função (recebe cada lote de registros)', {
      field: 'onBatch',
      received: typeof onBatch,
    })
  }
  checkPositiveInt(batchSize, 'batchSize')
  return { ...callOptions({ timeoutMs }), batchSize, onBatch }
}

// A mesma leitura em fluxo (client.getStream): os registros de `dados` chegam
// em lotes para onBatch, com os mesmos objetos que o get() devolveria.
// options: o que streamOptions devolveu. Devolve { count }.
export async function streamDados(client, slug, options) {
  return client.getStream(`/integracaobi/${slug}`, undefined, { ...options, field: 'dados' })
}
