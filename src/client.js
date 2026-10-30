import {
  AuthError,
  RateLimitError,
  InvalidPageError,
  EmptyResponseError,
  TimeoutError,
  ServerError,
  ClientError,
  NotFoundError,
  NetworkError,
  InvalidResponseError,
} from './errors.js'
import { sleep } from './sleep.js'
import { streamJsonArray } from './jsonStream.js'
import { CHANNELS, publish } from './diagnostics.js'
import { checkNonNegative, checkPositiveInt, checkTimeout } from './validate.js'

// Mensagem padrão do Django REST pra número de página fora do intervalo —
// normalmente um HTTP 404, mas o servidor MB às vezes devolve com status 200
// (mesmo formato { detail } da limitação real do servidor). Distinguir aqui
// evita que quem consome trate um erro de paginação como limite genérico de
// requisições.
function isInvalidPage(detail) {
  return /p[áa]gina inv[áa]lida|invalid page/i.test(detail)
}

// A limitação do servidor e o erro de paginação do DRF chegam como um objeto cuja ÚNICA
// chave é `detail`. Uma resposta legítima que só tenha também um campo
// `detail` (um relatório, um registro por id) não pode virar limite de
// requisições.
function detailOnly(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null
  // A checagem barata primeiro: quase nenhuma resposta tem `detail`, e só
  // nessas vale listar as chaves.
  return typeof data.detail === 'string' && Object.keys(data).length === 1 ? data.detail : null
}

// Leitura padrão do corpo: o texto inteiro.
const readText = async (res) => ({ text: await res.text() })

// Erro lançado pelo onBatch de quem chama, embrulhado para atravessar o
// tratamento de falhas de rede do #send sem virar NetworkError.
class CallbackFailure extends Error {
  constructor(cause) {
    super('onBatch falhou', { cause })
  }
}

// Leitura em fluxo (getStream): só um 200 é lido aos poucos; qualquer outro
// status vai como texto para a classificação de sempre (401, 4xx, 5xx).
function streamReader({ field, batchSize, onBatch }, slug) {
  return async (res, state) => {
    if (res.status !== 200) return readText(res)
    const out = await streamJsonArray(res.body, {
      field,
      batchSize,
      slug,
      onBatch: async (items) => {
        state.delivered = true
        try {
          await onBatch(items)
        } catch (err) {
          throw new CallbackFailure(err)
        }
      },
    })
    return out.found ? { count: out.count } : { text: out.text }
  }
}

// Quanto do corpo de uma resposta inválida vai para o erro — o bastante para
// reconhecer uma página HTML de erro, sem carregar o corpo inteiro. Exportado
// para o grid ERP usar o mesmo tamanho (interno: fora do mapa de exports).
export const BODY_SNIPPET_LENGTH = 200

export class HttpClient {
  #baseUrl
  #auth
  #timeoutMs
  #retryAttempts
  #retryBackoffMs
  #signal

  // retry: opcional — o padrão attempts:1 preserva o comportamento sem nova
  // tentativa.
  // Só se aplica a GET (idempotente) e só a falhas de rede transitórias
  // (fetch rejeitando antes de obter resposta) — nunca a POST/PUT/PATCH/DELETE,
  // nunca a timeout deliberado, nunca a RateLimitError/EmptyResponseError
  // (essas são respostas HTTP válidas, não falhas de transporte).
  // signal: cancela toda requisição desta instância (ex.: desligamento do processo).
  constructor({ baseUrl, auth, timeoutMs = 90_000, retry = {}, signal }) {
    checkTimeout(timeoutMs)
    const attempts = retry.attempts ?? 1
    checkPositiveInt(attempts, 'retry.attempts')
    const backoffMs = retry.backoffMs ?? 500
    checkNonNegative(backoffMs, 'retry.backoffMs')
    this.#baseUrl = baseUrl
    this.#auth = auth
    this.#timeoutMs = timeoutMs
    this.#retryAttempts = attempts
    this.#retryBackoffMs = backoffMs
    this.#signal = signal
  }

  // Usado pelo Auth para login e selectProperty. Mesma política de 401 dos
  // demais métodos (#request), com duas diferenças: sem token, vai sem
  // Authorization em vez de recusar (o login acontece justamente sem token);
  // e body null não é corpo (selectProperty manda null).
  // suppressRelogin: true evita loop infinito na chamada de relogin interna.
  // anonymous: true não manda o Authorization (usado pelo próprio login).
  //
  // A checagem de { detail } feita em #parse vale aqui também: sem ela, um 200
  // com limitação do servidor durante selectProperty() seria tratado como sucesso, e a
  // propriedade ficaria marcada como selecionada sem o servidor ter aplicado
  // a mudança.
  async postRaw(path, body, { suppressRelogin = false, anonymous = false, signal } = {}) {
    return this.#request('POST', path, {
      body: body ?? undefined,
      signal,
      suppressRelogin,
      anonymous,
      requireAuth: false,
    })
  }

  // Prazo da instância (os prazos sugeridos por endpoint nunca o encurtam).
  get timeoutMs() {
    return this.#timeoutMs
  }

  // Opções por chamada: signal (soma-se ao da instância) e timeoutMs (troca
  // o prazo da instância só nesta chamada, ex.: um recálculo pesado).
  async get(path, params = {}, { signal, timeoutMs } = {}) {
    return this.#request('GET', path, { params, signal, timeoutMs })
  }

  // GET em fluxo: entrega a lista `field` do corpo em lotes para onBatch, sem
  // guardar o corpo inteiro (jsonStream.js). Mesma autenticação, relogin,
  // prazo e classificação de erros do get(); o prazo cobre também o tempo de
  // onBatch. Sem nova tentativa depois do primeiro lote entregue (repetir
  // entregaria os mesmos registros de novo). Uma resposta sem a lista é um
  // envelope sem registros: { count: 0 }, como no get().
  async getStream(path, params, { signal, timeoutMs, field, batchSize, onBatch }) {
    return this.#request('GET', path, {
      params,
      signal,
      timeoutMs,
      stream: { field, batchSize, onBatch },
    })
  }

  async post(path, body = {}, { signal, timeoutMs } = {}) {
    return this.#request('POST', path, { body, signal, timeoutMs })
  }

  async put(path, body = {}, { signal, timeoutMs } = {}) {
    return this.#request('PUT', path, { body, signal, timeoutMs })
  }

  async patch(path, body = {}, { signal, timeoutMs } = {}) {
    return this.#request('PATCH', path, { body, signal, timeoutMs })
  }

  async delete(path, { signal, timeoutMs } = {}) {
    return this.#request('DELETE', path, { signal, timeoutMs })
  }

  // Núcleo de toda requisição, com uma política única de 401: uma requisição
  // que saiu com token e recebeu 401 reloga (ou espera o relogin em curso) e
  // repete UMA vez, com suppressRelogin; sem token, ou já na repetição, o 401
  // vira AuthError.
  //   requireAuth: true (get/post/put/patch/delete) recusa antes da rede sem
  //     token (getAuthHeader lança AuthError); false (postRaw) manda sem
  //     Authorization.
  //   anonymous: nunca manda Authorization, mesmo com token (o login).
  // Content-Type só quando há corpo — DELETE e GET nunca têm.
  async #request(method, path, options) {
    const {
      params,
      body,
      signal,
      timeoutMs = this.#timeoutMs,
      suppressRelogin = false,
      anonymous = false,
      requireAuth = true,
      stream,
    } = options
    checkTimeout(timeoutMs)
    const url = this.#buildUrl(path, params)
    const headers = {}
    let tokenUsed = null
    if (!anonymous && (requireAuth || this.#auth.getToken() !== null)) {
      headers.Authorization = this.#auth.getAuthHeader()
      tokenUsed = this.#auth.getToken()
    }
    headers.Dispositivo = '8'
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const fetchOpts = { method, headers }
    if (body !== undefined) fetchOpts.body = JSON.stringify(body)

    const page = params?.page
    // Alguns caminhos internos já trazem "?format=json": o evento leva só o caminho.
    const trace = { method, path: path.split('?')[0], page }
    const reader = stream ? streamReader(stream, path) : readText
    const { status, text, count } = await this.#send(
      url,
      fetchOpts,
      signal,
      timeoutMs,
      trace,
      reader
    )
    if (count !== undefined) return { count }

    if (status === 401) {
      if (!suppressRelogin && tokenUsed !== null) {
        await this.#reloginIfStale(tokenUsed)
        return this.#request(method, path, { ...options, suppressRelogin: true })
      }
      // Mensagens de sempre: nos métodos autenticados, um 401 aqui é sempre o
      // da repetição depois do relogin.
      throw new AuthError(
        requireAuth ? 'Relogin falhou — credenciais inválidas' : 'Autenticação falhou',
        { statusCode: 401, serverMessage: text }
      )
    }

    const data = this.#parse(method, path, status, text, page)
    // Em fluxo, sem a lista no corpo: envelope sem registros.
    if (stream) return { count: 0 }

    // Limite silencioso de requisições — 200 vazio no grid ERP. Restrito a GET: esse
    // formato só existe do lado de leitura do grid ERP paginado — sem essa
    // guarda, um POST/PUT/PATCH/DELETE de escrita que algum dia devolvesse
    // esse formato seria incorretamente tratado como limite silencioso de
    // requisições.
    if (
      method === 'GET' &&
      data &&
      typeof data.count === 'number' &&
      data.count === 0 &&
      Array.isArray(data.results) &&
      data.results.length === 0
    ) {
      publish(CHANNELS.emptyResponse, () => ({ method, path, page: page ?? 1 }))
      throw new EmptyResponseError(
        'Resposta vazia do servidor — possível limite silencioso de requisições. NÃO apagar dados locais.',
        { possiblyRateLimited: true, slug: path, page: page ?? 1 }
      )
    }

    return data
  }

  // Classificação comum de toda resposta que não é 401. Qualquer 4xx é um
  // erro real — nunca limite de requisições: a limitação de verdade do servidor
  // sempre responde com HTTP 200, e o DRF usa o mesmo formato { detail } tanto
  // para ela quanto para 404/403/405, por isso o status é checado antes do corpo.
  #parse(method, path, status, text, page) {
    if (status >= 500) {
      throw new ServerError(`Erro no servidor MB (${status})`, { statusCode: status, body: text })
    }
    if (status >= 400) {
      const ErrorClass = status === 404 ? NotFoundError : ClientError
      throw new ErrorClass(`Erro do cliente na API MultBovinos (${status})`, {
        statusCode: status,
        body: text,
      })
    }

    // 204, ou escrita com corpo vazio: não há o que devolver. Um GET sem corpo
    // é anômalo e cai no JSON.parse abaixo, virando InvalidResponseError.
    if (status === 204 || (text === '' && method !== 'GET')) return null

    let data
    try {
      data = JSON.parse(text)
    } catch (err) {
      throw new InvalidResponseError(`Resposta não-JSON da API MultBovinos (HTTP ${status})`, {
        statusCode: status,
        slug: path,
        bodySnippet: text.slice(0, BODY_SNIPPET_LENGTH),
        cause: err,
      })
    }

    const detail = detailOnly(data)
    if (detail !== null) {
      if (isInvalidPage(detail)) {
        throw new InvalidPageError(`Página inválida na API MultBovinos: ${detail}`, {
          detail,
          slug: path,
          page,
        })
      }
      throw new RateLimitError(`Limite de requisições da API MultBovinos: ${detail}`, {
        detail,
        slug: path,
        page,
      })
    }

    return data
  }

  // Um 401 de uma requisição que saiu com um token que já foi trocado (outra
  // chamada concorrente fez o relogin enquanto esta estava em voo) só precisa
  // ser repetido — relogar de novo geraria uma rajada de logins. Mas, se esse
  // relogin ainda não terminou, espera por ele: o token novo é gravado ANTES
  // da reseleção da fazenda, e repetir no meio leria a fazenda errada.
  async #reloginIfStale(tokenUsed) {
    if (this.#auth.getToken() === tokenUsed) await this.#auth.relogin(this)
    else await this.#auth.pendingRelogin()
  }

  #buildUrl(path, params) {
    const base = `${this.#baseUrl}${path}`
    if (!params || Object.keys(params).length === 0) return base
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString()
    return qs ? `${base}?${qs}` : base
  }

  // Faz a requisição e lê o corpo inteiro DENTRO do mesmo prazo: um servidor
  // que manda os cabeçalhos e trava o corpo também estoura o timeoutMs. Ler o
  // corpo (inclusive o do 401) libera a conexão.
  //
  // Erros: cancelamento por quem chama (signal da instância ou da chamada)
  // propaga o `reason` do signal, como o fetch nativo; estouro do prazo vira
  // TimeoutError; falha de transporte vira NetworkError depois das tentativas.
  // Nas escritas, os dois últimos levam mayHaveSucceeded: true — a requisição
  // pode ter chegado ao servidor, e repetir pode duplicar o registro.
  //
  // trace ({ method, path, page }): o que vai nos eventos de diagnóstico
  // (diagnostics.js) — o caminho sem a query string, nunca a URL inteira.
  //
  // readBody(res, state): lê o corpo (padrão: o texto inteiro). Em fluxo, marca
  // state.delivered ao entregar o primeiro lote, e daí em diante uma falha de
  // rede não é repetida. Um erro do próprio onBatch chega embrulhado em
  // CallbackFailure e sai como foi lançado, nunca como erro de rede.
  async #send(url, opts, callSignal, timeoutMs, trace, readBody = readText) {
    const maxAttempts = opts.method === 'GET' ? this.#retryAttempts : 1
    const mayHaveSucceeded = opts.method !== 'GET'
    // "Quem chama cancelou", montado uma vez para todas as tentativas: o signal
    // da instância, o da chamada, os dois combinados ou nenhum. Com os dois já
    // abortados, AbortSignal.any fica com o reason do primeiro (o da
    // instância), como antes.
    const external = [this.#signal, callSignal].filter(Boolean)
    const ext = external.length > 1 ? AbortSignal.any(external) : external[0]

    for (let attempt = 1; ; attempt++) {
      // Cancelado → lança o reason do signal (throwIfAborted faz exatamente isso).
      ext?.throwIfAborted()

      const deadline = new AbortController()
      const timer = setTimeout(() => deadline.abort(), timeoutMs)
      const started = performance.now()
      const state = { delivered: false }
      const done = (status, error) =>
        publish(CHANNELS.request, () => ({
          ...trace,
          status,
          error,
          attempt,
          durationMs: Math.round(performance.now() - started),
        }))
      try {
        const res = await fetch(url, {
          ...opts,
          signal: ext ? AbortSignal.any([deadline.signal, ext]) : deadline.signal,
        })
        const body = await readBody(res, state)
        done(res.status)
        return { status: res.status, ...body }
      } catch (err) {
        if (err instanceof CallbackFailure) {
          done(null, 'CallbackError')
          throw err.cause
        }
        if (err instanceof InvalidResponseError) {
          done(null, err.name)
          throw err
        }
        // status null: a requisição não teve resposta. error: o motivo, só o
        // nome (a mensagem leva a URL com a query string).
        const reason = ext?.aborted
          ? 'AbortError'
          : deadline.signal.aborted
            ? 'TimeoutError'
            : err.name
        done(null, reason)
        ext?.throwIfAborted()
        if (deadline.signal.aborted) {
          throw new TimeoutError(`Timeout após ${timeoutMs}ms: ${url}`, {
            url,
            method: opts.method,
            timeoutMs,
            mayHaveSucceeded,
            cause: err,
          })
        }
        if (attempt >= maxAttempts || state.delivered) {
          throw new NetworkError(`Falha de rede na API MultBovinos (${err.message}): ${url}`, {
            url,
            method: opts.method,
            attempts: attempt,
            mayHaveSucceeded,
            cause: err,
          })
        }
      } finally {
        clearTimeout(timer)
      }
      // A espera entre tentativas também é interrompida pelo signal.
      const delayMs = this.#retryBackoffMs * 2 ** (attempt - 1)
      publish(CHANNELS.retry, () => ({ ...trace, attempt, nextAttempt: attempt + 1, delayMs }))
      await sleep(delayMs, ext)
    }
  }
}
