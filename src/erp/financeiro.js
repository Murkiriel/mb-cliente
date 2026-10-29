import { FINANCEIRO_SLUGS } from '../constants.js'

// Endpoints adicionais do módulo financeiro do MB. Rotas REST reais e
// confirmadas, que só trazem dados se a conta usa esse módulo. Numa conta
// sem o módulo configurado as listagens vêm vazias e lançam
// EmptyResponseError — quem chama passa { allowEmpty: true } se esse é o seu caso.
export class FinanceiroErp {
  #grid

  constructor(grid) {
    this.#grid = grid
  }

  async getBancos(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.BANCO, params)
  }
  async getOrcamentos(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.ORCAMENTO, params)
  }
  async getMovimentacoesFinanceiras(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.MOVIMENTACAO_FINANCEIRA, params)
  }
  async getMovimentacoesFinanceirasContas(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.MOVIMENTACAO_FINANCEIRA_CONTA, params)
  }
  async getContasFinanceiras(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.CONTA_FINANCEIRO, params)
  }

  // Referenciada em erp.custos.getSaldoBiologico() como pré-requisito de
  // configuração.
  async getCotacoesDiarias(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.COTACOES_DIARIAS, params)
  }

  // ── Mais financeiro ────────────────────────────────────────────────────────
  async getBaixasMovimentacaoFinanceira(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.BAIXAR_MOVIMENTACAO_FINANCEIRA, params)
  }
  async getCobrancasMovimentacaoFinanceira(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.COBRANCA_MOVIMENTACAO_FINANCEIRA, params)
  }
  async getConciliacoesMovimentacaoFinanceira(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.CONCILIACAO_MOVIMENTACAO_FINANCEIRA, params)
  }
  async getContasPagar(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.CONTAS_PAGAR, params)
  }
  async getContasReceber(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.CONTAS_RECEBER, params)
  }
  async getEmprestimos(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.EMPRESTIMO, params)
  }
  async getGruposRateioContaFinanceira(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.GRUPO_RATEIO_CONTA_FINANCEIRA, params)
  }
  async getMovimentacaoFinanceiraArquivos(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.MOVIMENTACAO_FINANCEIRA_ARQUIVOS, params)
  }
  async getOpcoesPagamento(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.OPCAO_PAGAMENTO, params)
  }
  async getOrcamentosContrato(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.ORCAMENTO_CONTRATO, params)
  }
  async getProjetosFinanceiros(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.PROJETO_FINANCEIRO, params)
  }
  async getRetencoesMovimentacaoFinanceira(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.RETER_MOVIMENTACAO_FINANCEIRA, params)
  }
  async getTransferenciasBancarias(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.TRANSFERENCIA_BANCARIA, params)
  }
  async getRegrasPauta(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.REGRA_PAUTA, params)
  }
  async getCustosMensaisAnimais(params = {}) {
    return this.#grid.fetchPage(FINANCEIRO_SLUGS.CUSTOS_MENSAIS_ANIMAIS, params)
  }
}
