import { BI_SLUGS } from '../constants.js'
import { getDados } from './fetchDados.js'
import { ValidationError } from '../errors.js'

export class ProducaoRacaoBi {
  #client
  #auth

  constructor(client, auth) {
    this.#client = client
    this.#auth = auth
  }

  // Batidas de produção de ração com custo associado.
  // from e to obrigatórios no formato YYYY-MM-DD.
  // Escopo: por propriedade — mesmo contrato de propertyId de bi.animais.get().
  async get({ from, to, propertyId, timeoutMs } = {}) {
    if (!from || !to) {
      throw new ValidationError('from e to são obrigatórios', {
        field: 'from/to',
        received: { from, to },
      })
    }
    return this.#auth.inProperty(this.#client, propertyId, 'bi.producaoRacao.get', () =>
      getDados(
        this.#client,
        BI_SLUGS.PROD_RACAO,
        { data_inicio: from, data_fim: to },
        { timeoutMs }
      )
    )
  }

  // Formulação (ingredientes) de uma batida específica.
  // producaoId: valor de producao_id retornado por get().
  async getFormulacao(producaoId, { timeoutMs } = {}) {
    if (!producaoId) {
      throw new ValidationError('producaoId é obrigatório', {
        field: 'producaoId',
        received: producaoId,
      })
    }
    return getDados(
      this.#client,
      BI_SLUGS.PROD_RACAO_FORMULACAO,
      { producao: producaoId },
      { timeoutMs }
    )
  }
}
