import { BI_SLUGS } from '../constants.js'
import { getDados } from './fetchDados.js'
import { ValidationError } from '../errors.js'

export class SuplementacaoBi {
  #client
  #auth

  constructor(client, auth) {
    this.#client = client
    this.#auth = auth
  }

  // from e to obrigatórios no formato YYYY-MM-DD.
  // Escopo: por propriedade — mesmo contrato de propertyId de bi.animais.get().
  // Sem limite de janela (suporta intervalo de anos).
  async get({ from, to, propertyId, timeoutMs } = {}) {
    if (!from || !to) {
      throw new ValidationError('from e to são obrigatórios', {
        field: 'from/to',
        received: { from, to },
      })
    }

    return this.#auth.inProperty(this.#client, propertyId, 'bi.suplementacao.get', () =>
      getDados(
        this.#client,
        BI_SLUGS.SUPLEMENTACAO,
        { data_inicio: from, data_fim: to },
        { timeoutMs }
      )
    )
  }
}
