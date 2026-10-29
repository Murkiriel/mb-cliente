import { OUTROS_SLUGS } from '../constants.js'

// Endpoints adicionais. Rotas REST reais e confirmadas, que só trazem dados
// se a conta usa o módulo correspondente (equipamentos de curral cadastrados
// individualmente, módulo comercial de "gestão de contratos", vendas/agrícola
// avulsas). Numa conta sem o módulo configurado as listagens vêm vazias e lançam
// EmptyResponseError — quem chama passa { allowEmpty: true } se esse é o seu caso.
export class OutrosErp {
  #grid

  constructor(grid) {
    this.#grid = grid
  }

  // Equipamentos de curral/cocho
  async getBebedouros(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.BEBEDOURO, params)
  }
  async getBotijoes(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.BOTIJAO, params)
  }
  async getCanecas(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.CANECA, params)
  }
  async getCochosCompartilhados(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.COCHO_COMPARTILHADO, params)
  }
  async getLimpezasBebedouro(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.LIMPEZA_BEBEDOURO, params)
  }
  async getManutencoesAtivoMaquinario(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.MANUTENCAO_ATIVO_MAQUINARIO, params)
  }
  async getArvoresDeProcesso(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.ARVORE_DE_PROCESSO, params)
  }
  async getRecursosEmTalhao(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.RECURSO_EM_TALHAO, params)
  }

  // Gestão de contratos (módulo comercial separado)
  async getContratoProgramaSequencias(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.CONTRATO_PROGRAMA_SEQUENCIAS, params)
  }
  async getContratosVinculados(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.CONTRATOS_VINCULADOS, params)
  }
  async getEventosGestaoContratos(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.EVENTO_GESTAO_CONTRATOS, params)
  }
  async getEventosContato(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.EVENTOS_CONTATO, params)
  }
  async getGestaoContratos(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.GESTAO_CONTRATOS, params)
  }
  async getMensagensGestaoContratos(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.MENSAGENS_GESTAO_CONTRATOS, params)
  }
  async getMensagensGestaoContratosItens(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.MENSAGENS_GESTAO_CONTRATOS_ITENS, params)
  }
  async getParcerias(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PARCERIA, params)
  }
  async getEventoCavalgada2018(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.EVENTO_CAVALGADA_2018, params)
  }

  // Agrícola / produção / vendas avulsas
  async getProcessosProducao(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PROCESSO_PRODUCAO, params)
  }
  async getProducoes(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PRODUCAO, params)
  }
  async getProducoesPasto(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PRODUCAO_PASTO, params)
  }
  async getProducoesPremistura(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PRODUCAO_PREMISTURA, params)
  }
  async getProdutosCategoriaAnimais(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PRODUTOS_CATEGORIA_ANIMAIS, params)
  }
  async getProgramasNutricionaisPasto(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PROGRAMA_NUTRICIONAL_PASTO, params)
  }
  async getProgramasNutricionaisPastoRaca(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PROGRAMA_NUTRICIONAL_PASTO_RACA, params)
  }
  async getSaidasTransferenciaCentroDistribuicao(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.SAIDA_TRANSFERENCIA_CENTRO_DISTRIBUICAO, params)
  }
  async getSituacoesContato(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.SITUACAO_CONTATO, params)
  }
  async getUsosPessoalEpi(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.USO_PESSOAL_EPI, params)
  }
  async getImportacoesXmlNfe(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.IMPORTACAO_XML_NFE, params)
  }
  async getOrigensMovimentacaoMaterial(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.ORIGEM_MOVIMENTACAO_MATERIAL, params)
  }
  async getMotivosPerdaMovimentacaoMaterial(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.MOTIVO_PERDA_MOVIMENTACAO_MATERIAL, params)
  }
  async getVendasAvulsas(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.VENDA_AVULSA, params)
  }
  async getVendasComplementares(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.VENDA_COMPLEMENTAR, params)
  }
  async getVendasContrato(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.VENDA_CONTRATO, params)
  }
  async getVendasGenericas(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.VENDA_GENERICA, params)
  }
  async getPedidosEntrada(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PEDIDO_ENTRADA, params)
  }
  async getPedidosVendas(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PEDIDOS_VENDAS, params)
  }
  async getPedidoVenda(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.PEDIDO_VENDA, params)
  }
  async getAgendamentosAtividade(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.AGENDAMENTO_ATIVIDADE, params)
  }
  async getEstoqueRelatorioInsumosItens(params = {}) {
    return this.#grid.fetchPage(OUTROS_SLUGS.ESTOQUE_RELATORIO_INSUMOS_ITENS, params)
  }
}
