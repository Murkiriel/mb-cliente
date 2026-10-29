import { AuthError, ClientError, PropertyNotSelectedError, ValidationError } from './errors.js'
import { PropertyLock } from './propertyLock.js'
import { CHANNELS, publish } from './diagnostics.js'

export class Auth {
  #email
  #password
  #token = null
  #properties = []
  #selectedPropertyId = null
  #reloginPromise = null
  #lock = new PropertyLock()
  // Fazenda que a instância QUER selecionada: muda antes do POST de seleção,
  // para um relogin concorrente reselecionar a fazenda certa (e não uma
  // guardada antes de uma troca que ainda estava em voo).
  #desiredPropertyId = null
  // Conta as trocas reais de fazenda (não a reseleção do relogin): uma
  // paginação que vê o número mudar entre duas páginas está misturando
  // fazendas e falha em vez de seguir.
  #selectionGeneration = 0

  // properties: restaurar do cache em modo sem servidor — mesmo formato de connect()
  // ex.: new Auth(email, pass, { token: cachedToken, properties: cachedProperties })
  constructor(email, password, { token, properties } = {}) {
    this.#email = email
    this.#password = password
    if (token) this.#token = token
    if (properties) {
      this.#properties = properties.map((p) => ({
        id: p.id ?? p.propriedade_id,
        nome: p.nome,
        cnpj: p.cnpj ?? null,
      }))
    }
  }

  // Login explícito (connect): sessão nova, sem fazenda selecionada.
  async login(client) {
    const hadSelection = this.#selectedPropertyId !== null
    const result = await this.#authenticate(client)
    this.#desiredPropertyId = null
    if (hadSelection) this.#selectionGeneration++
    return result
  }

  // anonymous: o login nunca leva o JWT antigo — se a view exigisse um token
  // válido, um token vencido no cabeçalho impediria justamente a renovação.
  // O servidor zera a seleção de fazenda a cada login.
  async #authenticate(client) {
    let data
    try {
      data = await client.postRaw(
        '/login-integracao/',
        { email: this.#email, password: this.#password },
        { suppressRelogin: true, anonymous: true }
      )
    } catch (err) {
      // Credencial errada pode voltar como 400/403 (validação do DRF), não
      // só 401 — para quem chama, continua sendo falha de autenticação.
      if (err instanceof ClientError && (err.statusCode === 400 || err.statusCode === 403)) {
        throw new AuthError('Login recusado pela API MultBovinos', {
          statusCode: err.statusCode,
          serverMessage: err.body,
          cause: err,
        })
      }
      throw err
    }

    // Um 200 sem token não é login: sem esta checagem, connect() "dava
    // certo" e só a próxima chamada falhava, com uma mensagem enganosa.
    if (typeof data?.token !== 'string' || data.token === '') {
      throw new AuthError('Login sem token na resposta da API MultBovinos')
    }

    this.#token = data.token
    this.#properties = (data.fazendas ?? data.propriedades ?? []).map((p) => ({
      id: p.propriedade_id ?? p.id,
      nome: p.nome,
      cnpj: p.cnpj ?? null,
    }))
    this.#selectedPropertyId = null

    return { token: this.#token, properties: this.#properties }
  }

  // restore: reseleção feita pelo relogin — devolve a fazenda que a sessão já
  // tinha, então não conta como troca (não invalida paginação em andamento).
  async selectProperty(client, propertyId, { suppressRelogin = false, restore = false } = {}) {
    const prop = this.#properties.find((p) => p.id === propertyId)
    if (!prop) {
      throw new PropertyNotSelectedError(
        `Propriedade ${propertyId} não encontrada. Propriedades disponíveis: ${this.#properties.map((p) => p.id).join(', ')}`,
        { propertyId, availableIds: this.#properties.map((p) => p.id) }
      )
    }
    const previousDesired = this.#desiredPropertyId
    this.#desiredPropertyId = propertyId
    try {
      await client.postRaw(`/usuario/${propertyId}/selecione-propriedade/?format=json`, null, {
        suppressRelogin,
      })
    } catch (err) {
      this.#desiredPropertyId = previousDesired
      throw err
    }
    const from = this.#selectedPropertyId
    if (!restore && propertyId !== from) this.#selectionGeneration++
    this.#selectedPropertyId = propertyId
    // Toda seleção confirmada pelo servidor, inclusive a da mesma fazenda e a
    // reseleção do relogin (restore).
    publish(CHANNELS.propertySwitch, () => ({
      from,
      to: propertyId,
      restore,
      generation: this.#selectionGeneration,
    }))
  }

  // Reautentica e reseleciona a fazenda desejada — o login zera a seleção
  // no servidor, então sem isso qualquer chamada por propriedade após um 401
  // rodaria silenciosamente sem fazenda selecionada. A fazenda é lida DEPOIS
  // do login: se uma troca estava em voo, vale a fazenda nova.
  async relogin(client) {
    if (this.#reloginPromise) return this.#reloginPromise
    this.#reloginPromise = (async () => {
      const started = performance.now()
      const end = (ok, error) =>
        publish(CHANNELS.relogin, () => ({
          ok,
          error,
          propertyId: this.#desiredPropertyId,
          durationMs: Math.round(performance.now() - started),
        }))
      try {
        const result = await this.#authenticate(client)
        const target = this.#desiredPropertyId
        if (target != null) {
          // suppressRelogin: um 401 aqui não pode disparar outro relogin — ele
          // receberia esta mesma promise ainda pendente e esperaria por si
          // próprio para sempre. Com o token recém-emitido, 401 é erro final.
          await this.selectProperty(client, target, { suppressRelogin: true, restore: true })
        }
        end(true)
        return result
      } catch (err) {
        end(false, err.name)
        throw err
      }
    })().finally(() => {
      this.#reloginPromise = null
    })
    return this.#reloginPromise
  }

  // Relogin em andamento (ou null): quem recebeu 401 com um token que já foi
  // trocado espera esta promise — o token novo sai antes da reseleção da
  // fazenda, e repetir antes dela leria a fazenda errada.
  pendingRelogin() {
    return this.#reloginPromise
  }

  getSelectionGeneration() {
    return this.#selectionGeneration
  }

  // Seção exclusiva (ver PropertyLock) para operações que trocam ou dependem
  // da fazenda selecionada no servidor. O relogin NÃO passa por aqui: ele
  // acontece dentro de uma requisição que pode já estar na seção, e a
  // reseleção dele só restaura o estado que a seção espera.
  exclusive(fn) {
    return this.#lock.exclusive(fn)
  }

  // Leitura compartilhada (uma página de grid ERP; ver também inProperty):
  // várias juntas, nunca ao mesmo tempo que uma troca de fazenda.
  shared(fn) {
    return this.#lock.shared(fn)
  }

  // Seleciona a fazenda e roda fn sem que outra operação da instância mude
  // a seleção no meio. signal: uma chamada cancelada enquanto esperava a vez
  // na fila não chega a trocar a fazenda no servidor.
  withProperty(client, propertyId, fn, { signal } = {}) {
    const refusal = this.#nestedSwitch(propertyId)
    if (refusal) return Promise.reject(refusal)
    return this.#lock.exclusive(async () => {
      signal?.throwIfAborted()
      await this.selectProperty(client, propertyId)
      return fn()
    })
  }

  // Troca de fazenda pedida de dentro de uma seção da fila. Numa seção
  // exclusiva que já selecionou outra fazenda (ex.: o callback de
  // forAllProperties ou de getAll), a troca rodaria direto (a seção é
  // reentrante) e mudaria a fazenda no meio da operação de fora, que seguiria
  // lendo a fazenda errada. Numa leitura compartilhada, esperaria a própria
  // leitura terminar. Pedir a fazenda que a seção exclusiva já tem continua
  // valendo.
  #nestedSwitch(propertyId) {
    const mode = this.#lock.currentMode()
    if (mode === 'exclusive' && propertyId !== this.#selectedPropertyId) {
      return new ValidationError(
        `propertyId ${propertyId} pedido dentro de uma seção que já selecionou a fazenda ` +
          `${this.#selectedPropertyId} (ex.: callback de forAllProperties ou getAll): trocar ali ` +
          'mudaria a fazenda no meio da operação de fora. Use a fazenda da seção ou faça a ' +
          'chamada depois dela.',
        { field: 'propertyId', received: propertyId }
      )
    }
    if (mode === 'shared') {
      return new ValidationError(
        `propertyId ${propertyId} pedido dentro de uma leitura da fila de fazenda: a troca ` +
          'esperaria a própria leitura terminar. Faça a chamada depois dela.',
        { field: 'propertyId', received: propertyId }
      )
    }
    return null
  }

  // Escopo por fazenda, o mesmo para BI e custos: com propertyId, seleciona e
  // chama na mesma seção exclusiva (withProperty); sem (undefined ou null),
  // roda sobre a fazenda já selecionada numa leitura COMPARTILHADA — ela não
  // troca a seleção, só não pode coincidir com uma troca.
  // requireSelection: sem fazenda selecionada, o servidor devolveria os dados
  // de qualquer fazenda que outra sessão do mesmo usuário tivesse deixado
  // selecionada — então falha antes. false para os endpoints em que "sem
  // fazenda" é legítimo (custos sem propertyId = contrato inteiro).
  inProperty(client, propertyId, endpoint, fn, { requireSelection = true } = {}) {
    if (propertyId != null) return this.withProperty(client, propertyId, fn)
    return this.#lock.shared(() => {
      if (requireSelection && this.#selectedPropertyId === null) {
        throw new PropertyNotSelectedError(
          `${endpoint} é por fazenda: chame selectProperty() antes ou passe { propertyId }`,
          { endpoint }
        )
      }
      return fn()
    })
  }

  getToken() {
    return this.#token
  }
  getProperties() {
    return this.#properties
  }
  getSelectedPropertyId() {
    return this.#selectedPropertyId
  }

  // Usado pelo HttpClient para injetar o token atual no cabeçalho
  getAuthHeader() {
    if (!this.#token) throw new AuthError('Não autenticado — chame connect() primeiro')
    return `JWT ${this.#token}`
  }
}
