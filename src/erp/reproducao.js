import { REPRODUCAO_SLUGS } from '../constants.js'

// Módulos de reprodução/genética/sêmen/embrião + alguns módulos soltos de
// ciclo produtivo agrícola (ano agrícola, safra). Endpoints adicionais —
// rotas REST reais e confirmadas, que só trazem dados se a conta usa IATF,
// produção de embriões, comércio de sêmen ou o módulo agrícola no MB.
// Numa conta sem o módulo configurado as listagens vêm vazias e lançam
// EmptyResponseError — quem chama passa { allowEmpty: true } se esse é o seu caso.
export class ReproducaoErp {
  #grid

  constructor(grid) {
    this.#grid = grid
  }

  async getCios(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.CIO, params)
  }
  async getEstacoesMonta(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ESTACAO_MONTA, params)
  }
  async getEstacoesMontaIa(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ESTACAO_MONTA_IA, params)
  }
  async getAcasalamentos(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ACASALAMENTO, params)
  }
  async getResultadosSexagem(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.RESULTADO_SEXAGEM, params)
  }
  async getResultadosDiagnosticoGestacao(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.RESULTADO_DIAGNOSTICO_GESTACAO, params)
  }
  async getAvaliacoesOvarianas(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.AVALIACAO_OVARIANA, params)
  }
  async getAspiracoesOvocitos(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ASPIRACAO_OVOCITOS, params)
  }
  async getSafrasAnimal(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.SAFRA_ANIMAL, params)
  }
  async getAvaliacoesAtivo(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.AVALIACAO_ATIVO, params)
  }
  async getComprasSemen(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.COMPRA_SEMEN, params)
  }
  async getComprasSemenItens(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.COMPRA_SEMEN_ITEM, params)
  }
  async getVendasSemen(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.VENDA_SEMEN, params)
  }
  async getVendasSemenItens(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.VENDA_SEMEN_ITEM, params)
  }
  async getMovimentacoesSemen(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.MOVIMENTACAO_SEMEN, params)
  }
  async getComprasEmbriao(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.COMPRA_EMBRIAO, params)
  }
  async getVendasEmbriaoGrupo(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.VENDA_EMBRIAO_GRUPO, params)
  }
  async getTransferenciasLoteReprodutivo(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.TRANSFERENCIA_LOTE_REPRODUTIVO, params)
  }
  async getTransferenciasLoteGenetico(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.TRANSFERENCIA_LOTE_GENETICO, params)
  }
  async getComunicacoesAbczOnline(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.COMUNICACAO_ABCZ_ONLINE, params)
  }
  async getProblemas(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.PROBLEMA, params)
  }
  async getAnosAgricolas(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ANO_AGRICOLA, params)
  }
  async getCiclosProducao(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.CICLO_PRODUCAO, params)
  }
  async getCiclosProducaoLocalidade(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.CICLO_PRODUCAO_LOCALIDADE, params)
  }
  async getCentrosDistribuicao(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.CENTRO_DISTRIBUICAO, params)
  }
  async getSafras(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.SAFRA, params)
  }

  // Módulo agrícola (não-pecuário) — mesma situação: rota real, só traz
  // dados se o módulo é usado.
  async getAtividadesAgricolas(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ATIVIDADE_AGRICOLA, params)
  }
  async getClassificacoes(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.CLASSIFICACAO, params)
  }
  async getRegrasTributarias(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.REGRA_TRIBUTARIA, params)
  }
  async getVariedades(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.VARIEDADE, params)
  }

  // ── Mais reprodução/genética ───────────────────────────────────────────────
  async getAcasalamentosCobertura(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ACASALAMENTO_COBERTURA, params)
  }
  async getAgrupadoresCoberturasAbcz(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.AGRUPADOR_COBERTURAS_ABCZ, params)
  }
  async getAgrupadoresMortesAbcz(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.AGRUPADOR_MORTES_ABCZ, params)
  }
  async getAgrupadoresNascimentosAbcz(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.AGRUPADOR_NASCIMENTOS_ABCZ, params)
  }
  async getAgrupadoresPesagensAbcz(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.AGRUPADOR_PESAGENS_ABCZ, params)
  }
  async getCdcFiv(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.CDC_FIV, params)
  }
  async getCoberturasDiagnosticoGestacao(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.COBERTURA_DIAGNOSTICO_GESTACAO, params)
  }
  async getCoberturasTe(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.COBERTURA_TE, params)
  }
  async getCobrancasAspiracaoOvocitos(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.COBRANCA_ASPIRACAO_OVOCITOS, params)
  }
  async getCruzamentos(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.CRUZAMENTOS, params)
  }
  async getDescartesReprodutor(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.DESCARTE_REPRODUTOR, params)
  }
  async getDetalhesSituacaoMacho(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.DETALHE_SITUACAO_MACHO, params)
  }
  async getEstacoesMontaCampo(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ESTACAO_MONTA_CAMPO, params)
  }
  async getEstacoesMontaControlada(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ESTACAO_MONTA_CONTROLADA, params)
  }
  async getEstacoesMontaTe(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ESTACAO_MONTA_TE, params)
  }
  async getFemeas(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.FEMEA, params)
  }
  async getGruposEvento(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.GRUPO_EVENTO, params)
  }
  async getIdentificacoesAcasalamento(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.IDENTIFICACAO_ACASALAMENTO, params)
  }
  async getLotesGeneticos(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.LOTE_GENETICO, params)
  }
  async getLotesReprodutivos(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.LOTE_REPRODUTIVO, params)
  }
  async getMbivfWebFemea(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.MBIVF_WEB_FEMEA, params)
  }
  async getMbivfWebFemeaReceptora(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.MBIVF_WEB_FEMEA_RECEPTORA, params)
  }
  async getMbivfWebSemen(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.MBIVF_WEB_SEMEN, params)
  }
  async getMedicoesGeneticas(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.MEDICOES_GENETICAS, params)
  }
  async getMedicoesMorfologicas(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.MEDICOES_MORFOLOGICAS, params)
  }
  async getMotivosCancelamento(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.MOTIVO_CANCELAMENTO, params)
  }
  async getMotivosVisita(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.MOTIVO_VISITA, params)
  }
  async getOrigensSemen(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.ORIGEM_SEMEN, params)
  }
  async getParametrosPrevisao(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.PARAMETROS_PREVISAO, params)
  }
  async getProdutosFiv(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.PRODUTO_FIV, params)
  }
  async getRaques(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.RAQUE, params)
  }
  async getResultadosDiagnosticoGestacaoModal(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.RESULTADO_DIAGNOSTICO_GESTACAO_MODAL, params)
  }
  async getScoresFezes(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.SCORE_FEZES, params)
  }
  async getTiposDescarteEmbriao(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.TIPO_DESCARTE_EMBRIAO, params)
  }
  async getTiposOcorrencia(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.TIPO_OCORRENCIA, params)
  }
  async getTiposProblema(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.TIPO_PROBLEMA, params)
  }
  async getTiposProdutoFiv(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.TIPO_PRODUTO_FIV, params)
  }
  async getTourosMultiplos(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.TOURO_MULTIPLO, params)
  }
  async getTratamentosAnimalDoenca(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.TRATAMENTO_ANIMAL_DOENCA, params)
  }
  async getVisitasRgnRgd(params = {}) {
    return this.#grid.fetchPage(REPRODUCAO_SLUGS.VISITAS_RGN_RGD, params)
  }
}
