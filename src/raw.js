import { ValidationError } from './errors.js'

// Acesso público de baixo nível (mb.raw) para endpoints sem método dedicado.
// Delega direto ao HttpClient: mesma autenticação (cabeçalho JWT), mesmo relogin
// automático em 401, mesmo timeout da instância e mesma classificação de erros
// (AuthError, ClientError, ServerError, RateLimitError, InvalidPageError,
// TimeoutError e, só em GET, EmptyResponseError).
//
// Deliberadamente SEM espaçamento de chamadas, SEM interceptador e SEM parse de formato BR
// (ver README, "Decisões de arquitetura"): o retorno é o JSON cru da API.
export class RawApi {
  #client

  constructor(client) {
    this.#client = client
  }

  // GET {baseUrl}{path}?{params}. Parâmetros null/undefined são omitidos.
  async get(path, params = {}, options = {}) {
    return this.#client.get(checkPath(path), params, options)
  }

  // POST {baseUrl}{path} com body serializado em JSON (padrão {}).
  // Escrita na API é responsabilidade de quem chama.
  async post(path, body = {}, options = {}) {
    return this.#client.post(checkPath(path), body, options)
  }
}

// path é relativo à base da API (ex.: '/producaopasto/relatorio-gestao-nutricional-lote/').
// Recusar URL absoluta ou caminho sem '/' evita montar uma URL inválida em silêncio.
function checkPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new ValidationError(
      'mb.raw exige "path" relativo à base da API, começando com "/" (ex.: "/producaopasto/relatorio-gestao-nutricional-lote/")',
      { field: 'path', received: path }
    )
  }
  return path
}
