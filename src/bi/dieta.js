import { BI_SLUGS } from '../constants.js'
import { getDados } from './fetchDados.js'

export class DietaBi {
  #client

  constructor(client) {
    this.#client = client
  }

  async get({ timeoutMs } = {}) {
    return getDados(this.#client, BI_SLUGS.DIETA, undefined, { timeoutMs })
  }
}
