import { BI_SLUGS } from '../constants.js'
import { getDados } from './fetchDados.js'

export class FornecedoresBi {
  #client

  constructor(client) {
    this.#client = client
  }

  async get({ timeoutMs } = {}) {
    return getDados(this.#client, BI_SLUGS.FORNECEDORES, undefined, { timeoutMs })
  }
}
