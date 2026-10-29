import { ERP_SLUGS } from '../constants.js'

export class CadastrosErp {
  #grid

  constructor(grid) {
    this.#grid = grid
  }

  // ── Contatos (Fornecedores) ───────────────────────────────────────────────

  async getContatos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONTATO, params)
  }

  // body: { nome, tipo_pessoa ('PJ'|'PF'), categoria (1), ativo (true),
  //         cnpj?, razao_social?, cpf?, telefones?, emails?, enderecos? }
  async createContato(body) {
    return this.#grid.create(ERP_SLUGS.CONTATO, body)
  }

  // body: apenas os campos a alterar (PATCH parcial)
  async updateContato(id, body) {
    return this.#grid.patch(ERP_SLUGS.CONTATO, id, body)
  }

  // ── Grupos e Subgrupos de Material ────────────────────────────────────────

  async getGruposMaterial(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.GRUPO_MATERIAL, params)
  }

  // body: { nome, tipo? (1-6), ativo? }
  async createGrupoMaterial(body) {
    return this.#grid.create(ERP_SLUGS.GRUPO_MATERIAL, body)
  }

  async getSubgruposMaterial(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.SUBGRUPO_MATERIAL, params)
  }

  // body: { nome, grupo_material? (FK), ativo? }
  async createSubgrupoMaterial(body) {
    return this.#grid.create(ERP_SLUGS.SUBGRUPO_MATERIAL, body)
  }

  // ── Unidades de Medida ────────────────────────────────────────────────────

  async getUnidadesMedidas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.UNIDADES_MEDIDAS, params)
  }

  // body: { nome, tipo_unidade (1-UNIDADE|2-PESO|3-VOLUME|4-METRO), abreviatura?, multiplicador? }
  async createUnidadeMedida(body) {
    return this.#grid.create(ERP_SLUGS.UNIDADES_MEDIDAS, body)
  }

  // ── Materiais (Produtos) ──────────────────────────────────────────────────

  async getMateriais(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.MATERIAIS, params)
  }

  // body: { nome, grupo_material (FK), unidade_medida_compra (FK),
  //         unidade_medida_uso (FK), unidade_medida_venda_transf (FK),
  //         tipo_dose (0), peso_para_dose (0.0), codigo_erp, ativo (true),
  //         abreviatura?, subgrupo_material?, fabricante?, preco_custo_material?,
  //         codigo_material?, codigo_fabricante?, via_aplicacao_tratamento? }
  async createMaterial(body) {
    return this.#grid.create(ERP_SLUGS.MATERIAIS, body)
  }

  async updateMaterial(id, body) {
    return this.#grid.update(ERP_SLUGS.MATERIAIS, id, body)
  }

  // ── Cadastros somente leitura ─────────────────────────────────────────────

  async getRacoes(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.RACAO, params)
  }
  async getContas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONTA, params)
  }
  async getGruposContas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.GRUPO_CONTA, params)
  }
  async getFormasPagamento(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.FORMA_PAGAMENTO, params)
  }
  async getLotesAlimentares(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.LOTE_ALIMENTAR, params)
  }
  async getLotesFinalidade(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.LOTE_FINALIDADE, params)
  }
  async getRacas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.RACA, params)
  }
  async getPelagens(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.PELAGEM, params)
  }
  async getPropriedades(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.PROPRIEDADE, params)
  }
  // Podem estar vazios em contratos sem configuração de categoria/rebanho —
  // passe { allowEmpty: true } se for o seu caso.
  async getCategorias(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CATEGORIA, params)
  }
  async getRebanhos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.REBANHO, params)
  }
  async getCidades(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CIDADE, params)
  }
  async getEstados(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ESTADO, params)
  }
  async getPaises(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.PAIS, params)
  }

  // ── Endpoints adicionais ───────────────────────────────────────────────────

  // Cadastro genérico de pessoas/empresas — mais amplo que getContatos().
  async getEntidades(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ENTIDADE, params)
  }

  // Subconjunto de getEntidades() já filtrado a mão de obra (categoria fixa).
  async getContatosMaoDeObra(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONTATO_MAO_DE_OBRA, params)
  }

  // Localidades com dados operacionais de cocho/GMD (sobra_cocho, ims_pv_*,
  // peso_projetado) — mais rico que bi.localidades.get().
  async getLocalizacoes(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.LOCALIZACAO, params)
  }

  // Mesmo modelo de getLocalizacoes(), mas o servidor já filtra a currais de
  // confinamento (mesmos campos).
  async getCurrais(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CURRAIS, params)
  }

  async getGruposCurral(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.GRUPO_CURRAL, params)
  }
  async getCategoriasGta(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CATEGORIA_GTA, params)
  }
  async getSequenciasMicroregioes(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.SEQUENCIAS_MICROREGIOES, params)
  }
  async getConfiguracoesLayout(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONFIGURACOES_LAYOUT, params)
  }
  async getDispositivosMoveis(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.DISPOSITIVO_MOVEL, params)
  }

  // Catálogo de cultivares/variedades agrícolas.
  async getCulturas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CULTURA, params)
  }

  // Forma parecida com a de um material isolado — uso exato ainda incerto,
  // documentado para referência.
  async getOperacoes(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.OPERACAO, params)
  }

  // Genética/avaliação
  async getGrausDeSangue(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.GRAU_DE_SANGUE, params)
  }
  async getAvaliacoesMorfologicas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.AVALIACAO_MORFOLOGICA, params)
  }
  async getCorposLuteos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CORPO_LUTEO, params)
  }
  async getDetalhesSituacaoFemea(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.DETALHE_SITUACAO_FEMEA, params)
  }
  async getConfiguracoesCategoria(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONFIGURACAO_CATEGORIA, params)
  }
  async getConfiguracoesCategoriaGta(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONFIGURACAO_CATEGORIA_GTA, params)
  }
  async getConfiguracaoPlanilhaGenetica(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONFIGURACAO_PLANILHA_GENETICA, params)
  }
  async getConfiguracoesLeituraCocho(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONFIGURACOES_LEITURA_COCHO, params)
  }
  async getLotesDeAvaliacao(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.LOTE_DE_AVALIACAO, params)
  }
  async getTiposPastagem(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.TIPO_PASTAGEM, params)
  }
  async getDiasImprodutivos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.DIAS_IMPRODUTIVOS, params)
  }
  async getTecnicasCongelacao(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.TECNICA_CONGELACAO, params)
  }
  async getPreparacoesSemenConfig(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.PREPARACAO_SEMEN_CONFIG, params)
  }

  // Propriedade/estabelecimento/pessoas
  async getEstabelecimentosRuraisExternos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ESTABELECIMENTO_RURAL_EXTERNO, params)
  }
  async getEstabelecimentosRuraisInternosExternos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ESTABELECIMENTO_RURAL_INTERNO_EXTERNO, params)
  }
  async getProprietarios(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.PROPRIETARIO, params)
  }
  async getProprietariosContato(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.PROPRIETARIO_CONTATO, params)
  }
  async getSetores(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.SETOR, params)
  }

  // Fiscal/tributário (cadastro de referência, não movimento financeiro)
  async getCofinsSt(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.COFINS_ST, params)
  }
  async getIcmsOrigem(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ICMS_ORIGEM, params)
  }
  async getIcmsSt(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ICMS_ST, params)
  }
  async getPisSituacaoTributaria(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.PIS_SITUACAO_TRIBUTARIA, params)
  }
  async getNaturezasOperacoes(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.NATUREZA_OPERACOES, params)
  }
  async getCondicoesVenda(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONDICOES_VENDA, params)
  }
  async getCategoriasDeContato(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CATEGORIA_DE_CONTATO, params)
  }
  async getTiposDeCategoriaDeContato(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.TIPO_DE_CATEGORIA_DE_CONTATO, params)
  }
  async getCentrosDeCusto(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CENTRO_DE_CUSTO, params)
  }
  async getContasRateio(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONTA_RATEIO, params)
  }
  async getSituacoesMovimentacaoMaterial(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.SITUACAO_MOVIMENTACAO_MATERIAL, params)
  }
  async getTiposVendaDescarteDevolucao(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.TIPO_VENDA_DESCARTE_DEVOLUCAO, params)
  }
  async getUnidadesCotacao(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.UNIDADE_COTACAO, params)
  }
  async getTiposAdv(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.TIPOS_ADV, params)
  }
}
