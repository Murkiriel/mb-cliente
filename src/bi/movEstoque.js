import { BI_SLUGS } from '../constants.js'
import { forAllProperties } from '../helpers/allProperties.js'
import { getDados, streamDados, streamOptions } from './fetchDados.js'

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

  // As mesmas movimentações de get(), em lotes para onBatch — mesmo contrato
  // de bi.animais.forEachBatch(). O BI devolve o histórico inteiro da fazenda.
  async forEachBatch(options, onBatch) {
    const opts = streamOptions(options, onBatch)
    return this.#auth.inProperty(
      this.#client,
      options?.propertyId,
      'bi.movEstoque.forEachBatch',
      () => streamDados(this.#client, BI_SLUGS.MOV_ESTOQUE, opts)
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
