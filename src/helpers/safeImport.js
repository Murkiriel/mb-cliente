import { EmptyResponseError, RateLimitError, ValidationError } from '../errors.js'

// Guarda de troca tardia: só troca os dados locais se recebeu um conjunto
// COMPLETO e não vazio para repor. Protege contra limite silencioso de
// requisições (200 vazio indistinguível de fonte vazia) e contra coleta cortada no meio.
//
// fetch:       async () => items[] | { items, complete?, possiblyRateLimited? }
// replace:     async (items) => void — troca os dados locais pelos novos. Deve
//              ser TRANSACIONAL (apagar e inserir na mesma transação): se
//              falhar no meio, os dados antigos ficam intactos.
// onRateLimit: async (err) => void   — opcional, para registro em log/alerta
//
// Resultado: { preserved: false, inserted } quando trocou; senão
// { preserved: true, reason } com reason:
//   'rate_limit_explicit' | 'empty_response_possibly_rate_limited' |
//   'incomplete' (complete === false) | 'legitimately_empty'
export async function safeImport({ fetch, replace, onRateLimit, ...rest } = {}) {
  if ('insert' in rest || 'delete' in rest) {
    throw new ValidationError(
      'safeImport recebe replace(items) — uma troca transacional — no lugar de delete() + ' +
        'insert(): apagar e depois inserir em passos separados perdia os dados antigos se o ' +
        'insert falhasse',
      { field: 'replace', received: Object.keys(rest) }
    )
  }
  if (typeof fetch !== 'function' || typeof replace !== 'function') {
    throw new ValidationError('safeImport exige as funções fetch e replace', {
      field: 'fetch/replace',
      received: { fetch: typeof fetch, replace: typeof replace },
    })
  }

  let result
  try {
    result = await fetch()
  } catch (err) {
    if (err instanceof EmptyResponseError || err instanceof RateLimitError) {
      await onRateLimit?.(err)
      return {
        preserved: true,
        reason:
          err instanceof RateLimitError
            ? 'rate_limit_explicit'
            : 'empty_response_possibly_rate_limited',
      }
    }
    throw err
  }

  const isList = Array.isArray(result)
  const items = isList ? result : result?.items
  if (!isList && result?.complete === false) {
    return { preserved: true, reason: 'incomplete' }
  }
  if (!items || items.length === 0) {
    return {
      preserved: true,
      reason: result?.possiblyRateLimited
        ? 'empty_response_possibly_rate_limited'
        : 'legitimately_empty',
    }
  }

  await replace(items)
  return { preserved: false, inserted: items.length }
}
