import { BI_SLUGS } from '../constants.js'
import { getDados } from './fetchDados.js'

export class FazendasBi {
  #client

  constructor(client) {
    this.#client = client
  }

  // Retorna muito mais registros do que as propriedades da conta: é o
  // cadastro de PRODUTORES/fazendas de origem do gado comprado (nomes batem
  // com animais.fornecedor e gta.produtor_texto). Ainda assim, prefira
  // `fornecedores` (bi.fornecedores) como fonte de produtor — usa o mesmo entidade_id
  // referenciado por animal.fornecedor_id e gta.produtor, enquanto este
  // endpoint usa um ID de propriedade próprio que não bate com nenhum outro
  // lugar do sistema (só dá pra casar por nome). Ver README para detalhes.
  async get({ timeoutMs } = {}) {
    return getDados(this.#client, BI_SLUGS.FAZENDAS, undefined, { timeoutMs })
  }
}
