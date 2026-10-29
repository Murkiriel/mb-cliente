import { BI_SLUGS } from '../constants.js'
import { getDados } from './fetchDados.js'
import { ValidationError } from '../errors.js'
import { countCalendarDays } from '../parsers.js'

export class MovMateriaisBi {
  #client
  #auth

  constructor(client, auth) {
    this.#client = client
    this.#auth = auth
  }

  // from e to obrigatórios no formato YYYY-MM-DD.
  // Janela máxima: 31 dias corridos (inclusive).
  // Escopo: por propriedade (ver
  // docs/api.md, bi.movMateriais) — mesmo contrato de propertyId de
  // bi.animais.get().
  async get({ from, to, propertyId, timeoutMs } = {}) {
    if (!from || !to) {
      throw new ValidationError('from e to são obrigatórios', {
        field: 'from/to',
        received: { from, to },
      })
    }

    const days = countCalendarDays(from, to)
    if (days < 1 || days > 31) {
      throw new ValidationError(
        `Janela deve ser entre 1 e 31 dias corridos (inclusive). Recebido: ${days} dias.`,
        { field: 'to', received: days }
      )
    }

    return this.#auth.inProperty(this.#client, propertyId, 'bi.movMateriais.get', () =>
      getDados(
        this.#client,
        BI_SLUGS.MOV_MATERIAIS,
        { data_inicio: from, data_fim: to },
        { timeoutMs }
      )
    )
  }
}
