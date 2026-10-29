import { BI_SLUGS } from '../constants.js'
import { getDados } from './fetchDados.js'

export class LocalidadesBi {
  #client

  constructor(client) {
    this.#client = client
  }

  async get({ timeoutMs } = {}) {
    return getDados(this.#client, BI_SLUGS.LOCALIDADES, undefined, { timeoutMs })
  }
}
