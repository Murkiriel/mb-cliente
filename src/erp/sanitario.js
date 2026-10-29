import { ERP_SLUGS } from '../constants.js'

export class SanitarioErp {
  #grid

  constructor(grid) {
    this.#grid = grid
  }

  // Vacinações com custo (evento sanitário preventivo).
  // Observado devolvendo o MESMO conjunto de getTratamentos (mesmos ids): ao
  // juntar os dois, deduplique por id — nunca some as duas listas.
  //
  // ATENÇÃO: sujeito a limite silencioso de requisições após muitas páginas em
  // sequência. Usar safeImport() para proteger dados locais ao consumir em massa.
  // O espaçamento entre páginas e entre blocos é decisão de quem consome.
  //
  // options: { from?, to?, startPage?, maxPages?, delayMs?, onPage?, allowEmpty?, signal? }
  async getVacinacoes(options = {}) {
    return this.#grid.fetchAll(ERP_SLUGS.VACINACAO, options)
  }
  // Mesmas opções de getVacinacoes(), como iterador: for await (const { items, page } of …)
  iterVacinacoes(options = {}) {
    return this.#grid.pages(ERP_SLUGS.VACINACAO, options)
  }

  // Tratamentos sanitários com custo (tratamento clínico por animal).
  // Período inteiro inviável (volume grande). Sempre filtrar por data.
  // options: { from?, to?, startPage?, maxPages?, delayMs?, onPage? }
  async getTratamentos(options = {}) {
    return this.#grid.fetchAll(ERP_SLUGS.TRATAMENTO_ANIMAL, options)
  }
  // Mesmas opções de getTratamentos(), como iterador.
  iterTratamentos(options = {}) {
    return this.#grid.pages(ERP_SLUGS.TRATAMENTO_ANIMAL, options)
  }

  // Muitas propriedades legitimamente não têm nenhum exame cadastrado —
  // passe { allowEmpty: true } nesse caso.
  async getExames(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.EXAME, params)
  }

  // Eventos reprodutivos — rotas existem na API. Em contas sem dados
  // reprodutivos vêm vazias — passe { allowEmpty: true } nesse caso.
  async getProtocolos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.PROTOCOLO, params)
  }
  async getOcorrencias(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.OCORRENCIA, params)
  }
  async getSemens(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.SEMEN, params)
  }
  async getEmbrioes(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.EMBRIAO, params)
  }
  async getCoberturas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.COBERTURA, params)
  }
  async getPartos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.PARTO, params)
  }

  // Endpoints adicionais.
  async getDoencas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.DOENCA, params)
  }
  // Mapa doença <-> tratamento (qual tratamento se aplica a qual doença).
  async getDoencasTratamentos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.DOENCA_TRATAMENTO, params)
  }
  async getSubgruposMaterialTratamentos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.SUBGRUPO_MATERIAL_TRATAMENTOS, params)
  }
  async getSubgruposMaterialZoossanitario(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.SUBGRUPO_MATERIAL_ZOOSSANITARIO, params)
  }
  async getTiposProtocolo(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.TIPO_PROTOCOLO, params)
  }
  async getTratamentosHormonios(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.TRATAMENTO_HORMONIOS, params)
  }
  async getTratamentosVacinasVermifugos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.TRATAMENTOS_VACINAS_VERMIFUGOS, params)
  }
}
