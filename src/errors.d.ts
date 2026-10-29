// Classes de erro do SDK — também exportadas na raiz e no namespace `errors`.

export declare class MultBovinosError extends Error {
  constructor(message: string, context?: Record<string, unknown>)
}

export declare class AuthError extends MultBovinosError {
  readonly statusCode?: number
  readonly serverMessage?: string
}

/** Fazenda fora da lista do login (`propertyId`/`availableIds`), endpoint por
 * fazenda chamado sem `propertyId` e sem fazenda selecionada (`endpoint`), ou
 * fazenda trocada no meio de uma paginação (`reason`). */
export declare class PropertyNotSelectedError extends MultBovinosError {
  readonly propertyId?: number
  readonly availableIds?: number[]
  readonly endpoint?: string
  /** 'changed_during_pagination': a fazenda mudou entre duas páginas da mesma paginação.
   * 'changed_by_another_session': a página trouxe registros de outra fazenda (ver `verifyRecordProperty`). */
  readonly reason?: 'changed_during_pagination' | 'changed_by_another_session'
  /** Em 'changed_by_another_session': o valor do campo de fazenda do registro estranho. */
  readonly received?: unknown
}

export declare class RateLimitError extends MultBovinosError {
  readonly detail: string
  readonly slug: string
  /** Página do GET paginado em que a limitação do servidor chegou — para retomar dali. */
  readonly page?: number
}

/** Número de página inválido/fora do intervalo — HTTP 200 com
 * { detail: "Página inválida." } (mensagem padrão de paginação do Django
 * REST, mas devolvida com status 200 pelo servidor MB). Distinto de
 * RateLimitError: pode ser transitório (instabilidade de ordenação sob
 * concorrência) ou permanente — quem consome decide se/quanto esperar. */
export declare class InvalidPageError extends MultBovinosError {
  readonly detail: string
  readonly slug: string
  readonly page?: number
}

/** HTTP 4xx que não é 401 (AuthError) nem limite de requisições (a limitação real
 * do servidor sempre responde com HTTP 200) — ex.: 404 de slug errado, 403 de permissão
 * revogada, 405. */
export declare class ClientError extends MultBovinosError {
  readonly statusCode: number
  readonly body?: string
}

/** HTTP 404 (subclasse de `ClientError`). Nas buscas por id, em geral: registro de outra
 * fazenda ou id inexistente. */
export declare class NotFoundError extends ClientError {
  readonly statusCode: 404
}

export declare class EmptyResponseError extends MultBovinosError {
  readonly possiblyRateLimited: true
  readonly slug?: string
  readonly page?: number
}

export declare class EndpointUnavailableError extends MultBovinosError {
  readonly slug: string
  readonly reason: string
  readonly workaround: string | null
}

/** A requisição, incluindo a leitura do corpo, passou do `timeoutMs`. */
export declare class TimeoutError extends MultBovinosError {
  readonly url: string
  readonly method: string
  readonly timeoutMs: number
  /** true em escritas (POST/PUT/PATCH/DELETE): o servidor pode ter aplicado a
   * mudança — repetir pode duplicar o registro. */
  readonly mayHaveSucceeded: boolean
}

/** Falha de transporte (DNS, conexão, TLS) depois de esgotadas as tentativas.
 * O erro original do `fetch` fica em `cause`. */
export declare class NetworkError extends MultBovinosError {
  readonly url: string
  readonly method: string
  readonly attempts: number
  /** Mesmo sentido de `TimeoutError.mayHaveSucceeded`. */
  readonly mayHaveSucceeded: boolean
}

/** HTTP 5xx, com qualquer corpo (JSON ou não). */
export declare class ServerError extends MultBovinosError {
  readonly statusCode: number
  readonly body?: string
}

/** Resposta 2xx com corpo que não é JSON (ex.: página HTML de um proxy), ou
 * GET 2xx sem corpo. O `SyntaxError` original fica em `cause`. */
export declare class InvalidResponseError extends MultBovinosError {
  readonly statusCode: number
  readonly slug: string
  /** Os primeiros 200 caracteres do corpo. */
  readonly bodySnippet: string
}

export declare class ValidationError extends MultBovinosError {
  readonly field?: string
  readonly received?: unknown
}
