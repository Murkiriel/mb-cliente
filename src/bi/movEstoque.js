import { BI_SLUGS } from '../constants.js'
import { forAllProperties } from '../helpers/allProperties.js'
import { getDados } from './fetchDados.js'

export class MovEstoqueBi {
  #client
  #auth

  constructor(client, auth) {
    this.#client = client
    this.#auth = auth
  }

  // Movimentações de UMA fazenda — mesmo contrato de propertyId de
  // bi.animais.get().
  async get({ propertyId, timeoutMs } = {}) {
    return this.#auth.inProperty(this.#client, propertyId, 'bi.movEstoque.get', () =>
      getDados(this.#client, BI_SLUGS.MOV_ESTOQUE, undefined, { timeoutMs })
    )
  }

  // Agrega movimentações de todas as fazendas sequencialmente.
  // Após a execução, a propriedade selecionada é a última da lista.
  async getAll(propertyIds) {
    const items = await forAllProperties(
      this.#auth,
      this.#client,
      async () => (await this.get()).items,
      propertyIds
    )
    return { items, count: items.length }
  }
}
