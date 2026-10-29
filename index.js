import { Auth } from './src/auth.js'
import { HttpClient } from './src/client.js'
import { BiApi } from './src/bi/index.js'
import { ErpApi } from './src/erp/index.js'
import { RawApi } from './src/raw.js'
import { BASE_URL } from './src/constants.js'
import { forAllProperties as _forAllProperties } from './src/helpers/allProperties.js'
import { ValidationError } from './src/errors.js'

export class MultBovinos {
  #auth
  #client
  #bi
  #erp
  #raw

  // token + properties: restaurar estado do cache em ambientes sem servidor.
  // Em Lambda/Edge, guarde o retorno de connect() e reidrate a próxima instância:
  //   const { token, properties } = await mb.connect()
  //   // na próxima invocação:
  //   new MultBovinos({ email, password, token, properties })
  constructor({
    email,
    password,
    env = 'production',
    timeoutMs = 90_000,
    token,
    properties,
    retry,
    signal,
    verifyRecordProperty = true,
  } = {}) {
    const baseUrl = BASE_URL[env]
    if (!baseUrl) throw new Error(`Ambiente desconhecido: "${env}". Use "production" ou "test".`)
    if (typeof verifyRecordProperty !== 'boolean') {
      throw new ValidationError('verifyRecordProperty deve ser true ou false', {
        field: 'verifyRecordProperty',
        received: verifyRecordProperty,
      })
    }

    this.#auth = new Auth(email, password, { token, properties })
    this.#client = new HttpClient({ baseUrl, auth: this.#auth, timeoutMs, retry, signal })
    this.#bi = new BiApi(this.#client, this.#auth)
    this.#erp = new ErpApi(this.#client, this.#auth, { verifyRecordProperty })
    this.#raw = new RawApi(this.#client)
  }

  // Autentica e retorna { token, properties: [{ id, nome, cnpj }] }
  // Em modo sem servidor, guarde este retorno para reidratar a próxima instância.
  async connect() {
    return this.#auth.exclusive(() => this.#auth.login(this.#client))
  }

  // Reconecta sem perder a fazenda: novo login e reseleção da fazenda
  // desejada, sem contar como troca — paginações em andamento continuam. É o
  // que usar para reconectar no meio de uma sessão; connect() começa uma
  // sessão nova, sem fazenda, e interrompe as paginações em andamento.
  // Roda na seção exclusiva: o login zera a fazenda no servidor até a
  // reseleção, e uma página lida nesse intervalo viria sem fazenda.
  async relogin() {
    return this.#auth.exclusive(() => this.#auth.relogin(this.#client))
  }

  // Token atual — para persistência externa (sem servidor).
  getToken() {
    return this.#auth.getToken()
  }

  // Lista de propriedades disponíveis — para persistência externa (sem servidor).
  getProperties() {
    return this.#auth.getProperties()
  }

  // Seleciona uma propriedade como contexto ativo para endpoints ERP escopados.
  // Deve ser chamado antes de erp.estoque.getTratos(), erp.custos.*, etc.
  // Entra na mesma fila das operações por fazenda: não troca a seleção no
  // meio de um getAll()/forAllProperties()/custos em andamento.
  async selectProperty(propertyId) {
    // withProperty: a mesma recusa de troca dentro de uma seção (ex.: no
    // callback de forAllProperties) que os métodos com propertyId têm.
    return this.#auth.withProperty(this.#client, propertyId, () => undefined)
  }

  // Itera todas as fazendas SEQUENCIALMENTE, chamando callback(propertyId, property) em cada uma.
  // O callback deve retornar um array de itens; cada item recebe _propertyId automaticamente.
  // Útil para endpoints BI "por propriedade" que não têm getAll() próprio (ex: suplementacao).
  async forAllProperties(callback, propertyIds) {
    return _forAllProperties(this.#auth, this.#client, callback, propertyIds)
  }

  get bi() {
    return this.#bi
  }
  get erp() {
    return this.#erp
  }
  // Baixo nível: mb.raw.get(path, params?) / mb.raw.post(path, body?) para
  // endpoints sem método dedicado. JSON cru, sem parse BR, sem espaçamento de chamadas.
  get raw() {
    return this.#raw
  }
}

// Helpers públicos (sem forAllProperties: a função crua exige os objetos
// internos auth/client — use o método mb.forAllProperties(callback, propertyIds?)).
export * from './src/helpers/index.js'

// Classes de erro na raiz (import { AuthError } from '…') e também agrupadas
// no namespace errors.
export * from './src/errors.js'
export * as errors from './src/errors.js'
export * as constants from './src/constants.js'
