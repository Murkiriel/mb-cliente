export class MultBovinosError extends Error {
  // context.cause vira o `cause` nativo do Error (encadeamento padrão do
  // Node/DevTools); o resto do contexto vira propriedades do erro.
  constructor(message, context = {}) {
    const { cause, ...rest } = context
    super(message, cause === undefined ? undefined : { cause })
    this.name = this.constructor.name
    Object.assign(this, rest)
  }
}

// Login falhou ou token rejeitado (HTTP 401; no login, também 400/403)
export class AuthError extends MultBovinosError {
  // statusCode: number
  // serverMessage: string
}

// Endpoint "por propriedade" chamado sem selecionar propriedade antes
export class PropertyNotSelectedError extends MultBovinosError {
  // endpoint: string
  // reason: 'changed_during_pagination' | 'changed_by_another_session'
}

// Limite explícito de requisições — resposta continha { detail: "..." } (limitação
// do servidor, Django REST)
export class RateLimitError extends MultBovinosError {
  // detail: string
  // slug: string
  // page: number | undefined — página do GET paginado, para retomar dali
}

// Número de página inválido/fora do intervalo — resposta HTTP 200 com
// { detail: "Página inválida." } (mensagem padrão de paginação do Django
// REST, mas devolvida com status 200 pelo servidor MB em vez do 404 usual).
// Distinto de RateLimitError: às vezes é transitório (a paginação de um
// endpoint sem filtro de data pode reordenar sob concorrência), mas não é
// limitação do servidor — quem consome decide se/quanto vale a pena esperar antes de tentar de novo.
export class InvalidPageError extends MultBovinosError {
  // detail: string
  // slug: string
  // page: number | undefined
}

// HTTP 4xx não coberto por AuthError (401)/RateLimitError — ex.: 404 (slug
// errado), 403 (permissão revogada), 405. O DRF também usa { detail: "..." }
// nesses casos, mas SÓ a limitação real do servidor (RateLimitError) chega como
// HTTP 200 — qualquer outro status com `detail` é um erro de verdade, não limite
// de requisições.
export class ClientError extends MultBovinosError {
  // statusCode: number
  // body: string
}

// HTTP 404. Nas buscas por id (get*ById), em geral quer dizer "o registro é de
// outra fazenda" ou "o id não existe" — caso esperado, que quem chama trata
// com instanceof sem conferir statusCode.
export class NotFoundError extends ClientError {}

// Limite silencioso de requisições — HTTP 200 com count=0 e results=[]
// NUNCA apagar dados locais quando este erro ocorrer
export class EmptyResponseError extends MultBovinosError {
  // possiblyRateLimited: true
  // slug: string
  // page: number
}

// Endpoint marcado ❌ na documentação — não responde ou retorna erro de servidor
export class EndpointUnavailableError extends MultBovinosError {
  // slug: string
  // reason: string
  // workaround: string (quando existe alternativa)
}

// Requisição (incluindo a leitura do corpo) passou do timeoutMs
export class TimeoutError extends MultBovinosError {
  // url: string
  // method: string
  // timeoutMs: number
  // mayHaveSucceeded: boolean — true em escritas: o servidor pode ter
  //   aplicado a mudança; repetir pode duplicar o registro
  // cause: o erro original do fetch
}

// Falha de transporte (DNS, conexão recusada/derrubada, TLS) depois de
// esgotadas as tentativas — o fetch nativo só diria "TypeError: fetch failed"
export class NetworkError extends MultBovinosError {
  // url: string
  // method: string
  // attempts: number
  // mayHaveSucceeded: boolean — mesmo sentido do TimeoutError
  // cause: o erro original do fetch
}

// HTTP 5xx do servidor, com qualquer corpo (JSON ou não)
export class ServerError extends MultBovinosError {
  // statusCode: number
  // body: string
}

// Resposta 2xx com corpo que não é JSON (ex.: página HTML de erro de um
// proxy) ou GET 2xx sem corpo
export class InvalidResponseError extends MultBovinosError {
  // statusCode: number
  // slug: string
  // bodySnippet: string — os primeiros 200 caracteres do corpo
  // cause: o SyntaxError do JSON.parse
}

// Parâmetro inválido antes mesmo de chamar a API
export class ValidationError extends MultBovinosError {
  // field: string
  // received: any
}
