import { BI_SLUGS } from '../constants.js'
import { forAllProperties } from '../helpers/allProperties.js'
import { getDados, streamDados, streamOptions } from './fetchDados.js'

export class AnimaisBi {
  #client
  #auth

  constructor(client, auth) {
    this.#client = client
    this.#auth = auth
  }

  // Animais de UMA fazenda. Com propertyId, seleciona e consulta na mesma
  // seção exclusiva; sem, usa a fazenda já selecionada (selectProperty) e
  // lança PropertyNotSelectedError se não houver nenhuma.
  async get({ propertyId, timeoutMs } = {}) {
    return this.#auth.inProperty(this.#client, propertyId, 'bi.animais.get', () =>
      getDados(this.#client, BI_SLUGS.ANIMAIS, undefined, { timeoutMs })
    )
  }

  // Os mesmos animais de get(), em lotes de até batchSize (padrão 1000) para
  // onBatch, lidos aos poucos: a memória não cresce com o tamanho do rebanho.
  // onBatch roda dentro da seção da fazenda (não troque de fazenda nele) e é
  // esperado antes do próximo lote; o timeoutMs cobre também o tempo dele.
  // Devolve { count }.
  async forEachBatch(options, onBatch) {
    const opts = streamOptions(options, onBatch)
    return this.#auth.inProperty(this.#client, options?.propertyId, 'bi.animais.forEachBatch', () =>
      streamDados(this.#client, BI_SLUGS.ANIMAIS, opts)
    )
  }

  // Seleciona cada fazenda SEQUENCIALMENTE e agrega todos os animais.
  // Sequencial por design: selectProperty altera estado no servidor MB —
  // paralelizar causaria sobrescrita de seleção e resultados misturados.
  // propertyIds: number[] — padrão: todas as propriedades do login
  // Após a execução, a propriedade selecionada é a última da lista.
  async getAll(propertyIds) {
    const ids = propertyIds ?? this.#auth.getProperties().map((p) => p.id)
    const all = await forAllProperties(
      this.#auth,
      this.#client,
      async () => (await this.get()).items,
      ids
    )
    // byProperty na ordem dos ids, com os mesmos objetos de items.
    const byProperty = new Map(ids.map((id) => [id, []]))
    for (const item of all) byProperty.get(item._propertyId).push(item)
    return { items: all, count: all.length, byProperty }
  }
}
