// Endpoints adicionais (fora do manual oficial) — ver comentários em
// constants.js e nos módulos erp/*.js.
import { describe, it, expect, vi } from 'vitest'
import { ErpGrid } from '../src/erp/grid.js'
import { EmptyResponseError, EndpointUnavailableError } from '../src/errors.js'
import { CadastrosErp } from '../src/erp/cadastros.js'
import { EstoqueErp } from '../src/erp/estoque.js'
import { AnimaisErp } from '../src/erp/animais.js'
import { SanitarioErp } from '../src/erp/sanitario.js'
import { AuditoriaErp } from '../src/erp/auditoria.js'
import { ReproducaoErp } from '../src/erp/reproducao.js'
import { FinanceiroErp } from '../src/erp/financeiro.js'
import { OutrosErp } from '../src/erp/outros.js'
import { ERP_SLUGS, REPRODUCAO_SLUGS, FINANCEIRO_SLUGS, OUTROS_SLUGS } from '../src/constants.js'

function fakeGridClient() {
  return { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
}

// Testa que cada [método, slug] de uma classe delega corretamente ao grid,
// sem allowEmpty (endpoints reais/funcionais).
function testDelegation(className, Klass, buildArgs, cases) {
  describe(`${className} — endpoints adicionais`, () => {
    for (const [method, slug] of cases) {
      it(`${method} delega para /${slug}/`, async () => {
        const client = fakeGridClient()
        const instance = new Klass(...buildArgs(client))
        await instance[method]({ page: 1 })
        expect(client.get).toHaveBeenCalledWith(`/${slug}/`, expect.objectContaining({ page: 1 }))
      })
    }
  })
}

// Testa que cada [método, slug] de uma classe lança EmptyResponseError em
// resposta vazia e só a absorve com { allowEmpty: true } de quem chama.
function testAllowEmpty(className, Klass, buildArgs, cases) {
  describe(`${className} — módulos que podem vir vazios (allowEmpty de quem chama)`, () => {
    for (const [method, slug] of cases) {
      it(`${method}: vazio lança por padrão; com allowEmpty vira resultado vazio`, async () => {
        const client = {
          get: vi
            .fn()
            .mockRejectedValue(new EmptyResponseError('vazio', { possiblyRateLimited: true })),
        }
        const instance = new Klass(...buildArgs(client))
        await expect(instance[method]()).rejects.toBeInstanceOf(EmptyResponseError)
        const result = await instance[method]({ allowEmpty: true })
        expect(result.items).toHaveLength(0)
        expect(result.reason).toBe('possibly_rate_limited')
        expect(client.get).toHaveBeenCalledWith(`/${slug}/`, expect.any(Object))
      })
    }
  })
}

// Testa que um método indisponível lança EndpointUnavailableError (rota quebrada, 500).
function testStub(className, Klass, buildArgs, methods) {
  describe(`${className} — endpoints quebrados (500)`, () => {
    for (const method of methods) {
      it(`${method} lança EndpointUnavailableError`, () => {
        const instance = new Klass(...buildArgs({ get: vi.fn() }))
        expect(() => instance[method]()).toThrowError(EndpointUnavailableError)
      })
    }
  })
}

// ── CadastrosErp ─────────────────────────────────────────────────────────────
testDelegation('CadastrosErp', CadastrosErp, (client) => [new ErpGrid(client)], [
  ['getGrausDeSangue', ERP_SLUGS.GRAU_DE_SANGUE],
  ['getAvaliacoesMorfologicas', ERP_SLUGS.AVALIACAO_MORFOLOGICA],
  ['getCorposLuteos', ERP_SLUGS.CORPO_LUTEO],
  ['getDetalhesSituacaoFemea', ERP_SLUGS.DETALHE_SITUACAO_FEMEA],
  ['getConfiguracoesCategoria', ERP_SLUGS.CONFIGURACAO_CATEGORIA],
  ['getConfiguracoesCategoriaGta', ERP_SLUGS.CONFIGURACAO_CATEGORIA_GTA],
  ['getConfiguracaoPlanilhaGenetica', ERP_SLUGS.CONFIGURACAO_PLANILHA_GENETICA],
  ['getConfiguracoesLeituraCocho', ERP_SLUGS.CONFIGURACOES_LEITURA_COCHO],
  ['getLotesDeAvaliacao', ERP_SLUGS.LOTE_DE_AVALIACAO],
  ['getTiposPastagem', ERP_SLUGS.TIPO_PASTAGEM],
  ['getDiasImprodutivos', ERP_SLUGS.DIAS_IMPRODUTIVOS],
  ['getTecnicasCongelacao', ERP_SLUGS.TECNICA_CONGELACAO],
  ['getPreparacoesSemenConfig', ERP_SLUGS.PREPARACAO_SEMEN_CONFIG],
  ['getEstabelecimentosRuraisExternos', ERP_SLUGS.ESTABELECIMENTO_RURAL_EXTERNO],
  ['getEstabelecimentosRuraisInternosExternos', ERP_SLUGS.ESTABELECIMENTO_RURAL_INTERNO_EXTERNO],
  ['getProprietarios', ERP_SLUGS.PROPRIETARIO],
  ['getProprietariosContato', ERP_SLUGS.PROPRIETARIO_CONTATO],
  ['getSetores', ERP_SLUGS.SETOR],
  ['getCofinsSt', ERP_SLUGS.COFINS_ST],
  ['getIcmsOrigem', ERP_SLUGS.ICMS_ORIGEM],
  ['getIcmsSt', ERP_SLUGS.ICMS_ST],
  ['getPisSituacaoTributaria', ERP_SLUGS.PIS_SITUACAO_TRIBUTARIA],
  ['getNaturezasOperacoes', ERP_SLUGS.NATUREZA_OPERACOES],
  ['getCondicoesVenda', ERP_SLUGS.CONDICOES_VENDA],
  ['getCategoriasDeContato', ERP_SLUGS.CATEGORIA_DE_CONTATO],
  ['getTiposDeCategoriaDeContato', ERP_SLUGS.TIPO_DE_CATEGORIA_DE_CONTATO],
  ['getCentrosDeCusto', ERP_SLUGS.CENTRO_DE_CUSTO],
  ['getContasRateio', ERP_SLUGS.CONTA_RATEIO],
  ['getSituacoesMovimentacaoMaterial', ERP_SLUGS.SITUACAO_MOVIMENTACAO_MATERIAL],
  ['getTiposVendaDescarteDevolucao', ERP_SLUGS.TIPO_VENDA_DESCARTE_DEVOLUCAO],
  ['getUnidadesCotacao', ERP_SLUGS.UNIDADE_COTACAO],
  ['getTiposAdv', ERP_SLUGS.TIPOS_ADV],
])

// ── SanitarioErp ─────────────────────────────────────────────────────────────
testDelegation('SanitarioErp', SanitarioErp, (client) => [new ErpGrid(client)], [
  ['getDoencas', ERP_SLUGS.DOENCA],
  ['getDoencasTratamentos', ERP_SLUGS.DOENCA_TRATAMENTO],
  ['getSubgruposMaterialTratamentos', ERP_SLUGS.SUBGRUPO_MATERIAL_TRATAMENTOS],
  ['getSubgruposMaterialZoossanitario', ERP_SLUGS.SUBGRUPO_MATERIAL_ZOOSSANITARIO],
  ['getTiposProtocolo', ERP_SLUGS.TIPO_PROTOCOLO],
  ['getTratamentosHormonios', ERP_SLUGS.TRATAMENTO_HORMONIOS],
  ['getTratamentosVacinasVermifugos', ERP_SLUGS.TRATAMENTOS_VACINAS_VERMIFUGOS],
])

// ── AnimaisErp ───────────────────────────────────────────────────────────────
testDelegation(
  'AnimaisErp',
  AnimaisErp,
  (client) => [new ErpGrid(client), { post: vi.fn(), put: vi.fn() }],
  [
    ['getMedicoesPesagem', ERP_SLUGS.MEDICOES_PESAGEM],
    ['getAlteracoesSisbov', ERP_SLUGS.ANIMAL_ALTERACAO_SISBOV],
    ['getReidentificacoesSisbov', ERP_SLUGS.ANIMAL_REIDENTIFICADO_SISBOV],
    ['getAnimaisDesmamados', ERP_SLUGS.ANIMAL_DESMAMADO],
    ['getRecepcoesAnimais', ERP_SLUGS.RECEPCAO_ANIMAIS],
    ['getMotivosDescarteReprodutor', ERP_SLUGS.MOTIVO_DESCARTE_REPRODUTOR],
    ['getTiposMorte', ERP_SLUGS.TIPO_MORTE],
    ['getMachos', ERP_SLUGS.MACHO],
  ]
)

// ── EstoqueErp ───────────────────────────────────────────────────────────────
testDelegation('EstoqueErp', EstoqueErp, (client) => [new ErpGrid(client), { post: vi.fn() }], [
  ['getPremisturas', ERP_SLUGS.PREMISTURA],
  ['getProdutoServicos', ERP_SLUGS.PRODUTO_SERVICOS],
  ['getAlteracoesPercentualMateriaSeca', ERP_SLUGS.ALTERACAO_PERCENTUAL_MATERIA_SECA],
  ['getEntradaMaterialItens', ERP_SLUGS.ENTRADA_MATERIAL_ITEM],
  ['getEntradasSaidasMaterial', ERP_SLUGS.ENTRADA_SAIDA_MATERIAL],
  ['getAplicacoesConsumo', ERP_SLUGS.APLICACAO_CONSUMO],
  ['getAplicacaoConsumoLoteAnimalItens', ERP_SLUGS.APLICACAO_CONSUMO_LOTE_ANIMAL_ITEM],
  ['getSaidasTransferenciaPropriedades', ERP_SLUGS.SAIDA_TRANSFERENCIA_PROPRIEDADES],
  ['getSaidasVendaPerda', ERP_SLUGS.SAIDA_VENDA_PERDA],
  ['getOutrasSaidas', ERP_SLUGS.OUTRAS_SAIDAS],
  ['getAtivos', ERP_SLUGS.ATIVOS],
  ['getMaquinariosConfinamento', ERP_SLUGS.MAQUINARIOS_CONFINAMENTO],
  ['getTiposAtivos', ERP_SLUGS.TIPOS_ATIVOS],
])

// ── AuditoriaErp ─────────────────────────────────────────────────────────────
testDelegation('AuditoriaErp', AuditoriaErp, (client) => [new ErpGrid(client)], [
  ['getHistoricoAcoesApp', ERP_SLUGS.HISTORICO_ACOES_APP],
  ['getHistoricoMovimentacaoLoteDeAvaliacao', ERP_SLUGS.HISTORICO_MOVIMENTACAO_LOTE_DE_AVALIACAO],
  [
    'getHistoricoMovimentacaoProgramaNutricional',
    ERP_SLUGS.HISTORICO_MOVIMENTACAO_PROGRAMA_NUTRICIONAL,
  ],
  ['getControleSincronizacaoCurral', ERP_SLUGS.CONTROLE_SINCRONIZACAO_CURRAL],
  ['getControleSincronizacaoMbTratos', ERP_SLUGS.CONTROLE_SINCRONIZACAO_MBTRATOS],
  ['getCurralErrosExecucaoEvento', ERP_SLUGS.CURRAL_ERROS_EXECUCAO_EVENTO],
  [
    'getEstatisticasRotinaEstoqueAnimalDetalhe',
    ERP_SLUGS.ESTATISTICAS_ROTINA_ESTOQUE_ANIMAL_DETALHE,
  ],
])
testStub('AuditoriaErp', AuditoriaErp, (client) => [new ErpGrid(client)], [
  'getHistoricoExecucaoViewPg',
])

// ── ReproducaoErp ────────────────────────────────────────────────────────────
testAllowEmpty('ReproducaoErp', ReproducaoErp, (client) => [new ErpGrid(client)], [
  ['getAcasalamentosCobertura', REPRODUCAO_SLUGS.ACASALAMENTO_COBERTURA],
  ['getAgrupadoresCoberturasAbcz', REPRODUCAO_SLUGS.AGRUPADOR_COBERTURAS_ABCZ],
  ['getAgrupadoresMortesAbcz', REPRODUCAO_SLUGS.AGRUPADOR_MORTES_ABCZ],
  ['getAgrupadoresNascimentosAbcz', REPRODUCAO_SLUGS.AGRUPADOR_NASCIMENTOS_ABCZ],
  ['getAgrupadoresPesagensAbcz', REPRODUCAO_SLUGS.AGRUPADOR_PESAGENS_ABCZ],
  ['getCdcFiv', REPRODUCAO_SLUGS.CDC_FIV],
  ['getCoberturasDiagnosticoGestacao', REPRODUCAO_SLUGS.COBERTURA_DIAGNOSTICO_GESTACAO],
  ['getCoberturasTe', REPRODUCAO_SLUGS.COBERTURA_TE],
  ['getCobrancasAspiracaoOvocitos', REPRODUCAO_SLUGS.COBRANCA_ASPIRACAO_OVOCITOS],
  ['getCruzamentos', REPRODUCAO_SLUGS.CRUZAMENTOS],
  ['getDescartesReprodutor', REPRODUCAO_SLUGS.DESCARTE_REPRODUTOR],
  ['getDetalhesSituacaoMacho', REPRODUCAO_SLUGS.DETALHE_SITUACAO_MACHO],
  ['getEstacoesMontaCampo', REPRODUCAO_SLUGS.ESTACAO_MONTA_CAMPO],
  ['getEstacoesMontaControlada', REPRODUCAO_SLUGS.ESTACAO_MONTA_CONTROLADA],
  ['getEstacoesMontaTe', REPRODUCAO_SLUGS.ESTACAO_MONTA_TE],
  ['getFemeas', REPRODUCAO_SLUGS.FEMEA],
  ['getGruposEvento', REPRODUCAO_SLUGS.GRUPO_EVENTO],
  ['getIdentificacoesAcasalamento', REPRODUCAO_SLUGS.IDENTIFICACAO_ACASALAMENTO],
  ['getLotesGeneticos', REPRODUCAO_SLUGS.LOTE_GENETICO],
  ['getLotesReprodutivos', REPRODUCAO_SLUGS.LOTE_REPRODUTIVO],
  ['getMbivfWebFemea', REPRODUCAO_SLUGS.MBIVF_WEB_FEMEA],
  ['getMbivfWebFemeaReceptora', REPRODUCAO_SLUGS.MBIVF_WEB_FEMEA_RECEPTORA],
  ['getMbivfWebSemen', REPRODUCAO_SLUGS.MBIVF_WEB_SEMEN],
  ['getMedicoesGeneticas', REPRODUCAO_SLUGS.MEDICOES_GENETICAS],
  ['getMedicoesMorfologicas', REPRODUCAO_SLUGS.MEDICOES_MORFOLOGICAS],
  ['getMotivosCancelamento', REPRODUCAO_SLUGS.MOTIVO_CANCELAMENTO],
  ['getMotivosVisita', REPRODUCAO_SLUGS.MOTIVO_VISITA],
  ['getOrigensSemen', REPRODUCAO_SLUGS.ORIGEM_SEMEN],
  ['getParametrosPrevisao', REPRODUCAO_SLUGS.PARAMETROS_PREVISAO],
  ['getProdutosFiv', REPRODUCAO_SLUGS.PRODUTO_FIV],
  ['getRaques', REPRODUCAO_SLUGS.RAQUE],
  ['getResultadosDiagnosticoGestacaoModal', REPRODUCAO_SLUGS.RESULTADO_DIAGNOSTICO_GESTACAO_MODAL],
  ['getScoresFezes', REPRODUCAO_SLUGS.SCORE_FEZES],
  ['getTiposDescarteEmbriao', REPRODUCAO_SLUGS.TIPO_DESCARTE_EMBRIAO],
  ['getTiposOcorrencia', REPRODUCAO_SLUGS.TIPO_OCORRENCIA],
  ['getTiposProblema', REPRODUCAO_SLUGS.TIPO_PROBLEMA],
  ['getTiposProdutoFiv', REPRODUCAO_SLUGS.TIPO_PRODUTO_FIV],
  ['getTourosMultiplos', REPRODUCAO_SLUGS.TOURO_MULTIPLO],
  ['getTratamentosAnimalDoenca', REPRODUCAO_SLUGS.TRATAMENTO_ANIMAL_DOENCA],
  ['getVisitasRgnRgd', REPRODUCAO_SLUGS.VISITAS_RGN_RGD],
])

// ── FinanceiroErp ────────────────────────────────────────────────────────────
testAllowEmpty('FinanceiroErp', FinanceiroErp, (client) => [new ErpGrid(client)], [
  ['getBaixasMovimentacaoFinanceira', FINANCEIRO_SLUGS.BAIXAR_MOVIMENTACAO_FINANCEIRA],
  ['getCobrancasMovimentacaoFinanceira', FINANCEIRO_SLUGS.COBRANCA_MOVIMENTACAO_FINANCEIRA],
  ['getConciliacoesMovimentacaoFinanceira', FINANCEIRO_SLUGS.CONCILIACAO_MOVIMENTACAO_FINANCEIRA],
  ['getContasPagar', FINANCEIRO_SLUGS.CONTAS_PAGAR],
  ['getContasReceber', FINANCEIRO_SLUGS.CONTAS_RECEBER],
  ['getEmprestimos', FINANCEIRO_SLUGS.EMPRESTIMO],
  ['getGruposRateioContaFinanceira', FINANCEIRO_SLUGS.GRUPO_RATEIO_CONTA_FINANCEIRA],
  ['getMovimentacaoFinanceiraArquivos', FINANCEIRO_SLUGS.MOVIMENTACAO_FINANCEIRA_ARQUIVOS],
  ['getOpcoesPagamento', FINANCEIRO_SLUGS.OPCAO_PAGAMENTO],
  ['getOrcamentosContrato', FINANCEIRO_SLUGS.ORCAMENTO_CONTRATO],
  ['getProjetosFinanceiros', FINANCEIRO_SLUGS.PROJETO_FINANCEIRO],
  ['getRetencoesMovimentacaoFinanceira', FINANCEIRO_SLUGS.RETER_MOVIMENTACAO_FINANCEIRA],
  ['getTransferenciasBancarias', FINANCEIRO_SLUGS.TRANSFERENCIA_BANCARIA],
  ['getRegrasPauta', FINANCEIRO_SLUGS.REGRA_PAUTA],
  ['getCustosMensaisAnimais', FINANCEIRO_SLUGS.CUSTOS_MENSAIS_ANIMAIS],
])

// ── OutrosErp ────────────────────────────────────────────────────────────────
testAllowEmpty('OutrosErp', OutrosErp, (client) => [new ErpGrid(client)], [
  ['getBebedouros', OUTROS_SLUGS.BEBEDOURO],
  ['getBotijoes', OUTROS_SLUGS.BOTIJAO],
  ['getCanecas', OUTROS_SLUGS.CANECA],
  ['getCochosCompartilhados', OUTROS_SLUGS.COCHO_COMPARTILHADO],
  ['getLimpezasBebedouro', OUTROS_SLUGS.LIMPEZA_BEBEDOURO],
  ['getManutencoesAtivoMaquinario', OUTROS_SLUGS.MANUTENCAO_ATIVO_MAQUINARIO],
  ['getArvoresDeProcesso', OUTROS_SLUGS.ARVORE_DE_PROCESSO],
  ['getRecursosEmTalhao', OUTROS_SLUGS.RECURSO_EM_TALHAO],
  ['getContratoProgramaSequencias', OUTROS_SLUGS.CONTRATO_PROGRAMA_SEQUENCIAS],
  ['getContratosVinculados', OUTROS_SLUGS.CONTRATOS_VINCULADOS],
  ['getEventosGestaoContratos', OUTROS_SLUGS.EVENTO_GESTAO_CONTRATOS],
  ['getEventosContato', OUTROS_SLUGS.EVENTOS_CONTATO],
  ['getGestaoContratos', OUTROS_SLUGS.GESTAO_CONTRATOS],
  ['getMensagensGestaoContratos', OUTROS_SLUGS.MENSAGENS_GESTAO_CONTRATOS],
  ['getMensagensGestaoContratosItens', OUTROS_SLUGS.MENSAGENS_GESTAO_CONTRATOS_ITENS],
  ['getParcerias', OUTROS_SLUGS.PARCERIA],
  ['getEventoCavalgada2018', OUTROS_SLUGS.EVENTO_CAVALGADA_2018],
  ['getProcessosProducao', OUTROS_SLUGS.PROCESSO_PRODUCAO],
  ['getProducoes', OUTROS_SLUGS.PRODUCAO],
  ['getProducoesPasto', OUTROS_SLUGS.PRODUCAO_PASTO],
  ['getProducoesPremistura', OUTROS_SLUGS.PRODUCAO_PREMISTURA],
  ['getProdutosCategoriaAnimais', OUTROS_SLUGS.PRODUTOS_CATEGORIA_ANIMAIS],
  ['getProgramasNutricionaisPasto', OUTROS_SLUGS.PROGRAMA_NUTRICIONAL_PASTO],
  ['getProgramasNutricionaisPastoRaca', OUTROS_SLUGS.PROGRAMA_NUTRICIONAL_PASTO_RACA],
  [
    'getSaidasTransferenciaCentroDistribuicao',
    OUTROS_SLUGS.SAIDA_TRANSFERENCIA_CENTRO_DISTRIBUICAO,
  ],
  ['getSituacoesContato', OUTROS_SLUGS.SITUACAO_CONTATO],
  ['getUsosPessoalEpi', OUTROS_SLUGS.USO_PESSOAL_EPI],
  ['getImportacoesXmlNfe', OUTROS_SLUGS.IMPORTACAO_XML_NFE],
  ['getOrigensMovimentacaoMaterial', OUTROS_SLUGS.ORIGEM_MOVIMENTACAO_MATERIAL],
  ['getMotivosPerdaMovimentacaoMaterial', OUTROS_SLUGS.MOTIVO_PERDA_MOVIMENTACAO_MATERIAL],
  ['getVendasAvulsas', OUTROS_SLUGS.VENDA_AVULSA],
  ['getVendasComplementares', OUTROS_SLUGS.VENDA_COMPLEMENTAR],
  ['getVendasContrato', OUTROS_SLUGS.VENDA_CONTRATO],
  ['getVendasGenericas', OUTROS_SLUGS.VENDA_GENERICA],
  ['getPedidosEntrada', OUTROS_SLUGS.PEDIDO_ENTRADA],
  ['getPedidosVendas', OUTROS_SLUGS.PEDIDOS_VENDAS],
  ['getPedidoVenda', OUTROS_SLUGS.PEDIDO_VENDA],
  ['getAgendamentosAtividade', OUTROS_SLUGS.AGENDAMENTO_ATIVIDADE],
  ['getEstoqueRelatorioInsumosItens', OUTROS_SLUGS.ESTOQUE_RELATORIO_INSUMOS_ITENS],
])

// ── getMedicoesPesagem ─────────────────────────────────────────────────────
describe('AnimaisErp.getMedicoesPesagem — pesagem por animal', () => {
  it('repassa params ao grid normalmente (mesmo sem filtro efetivo no servidor)', async () => {
    const client = fakeGridClient()
    const animais = new AnimaisErp(new ErpGrid(client), { post: vi.fn(), put: vi.fn() })
    const result = await animais.getMedicoesPesagem({ page: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/medicoespesagem/',
      expect.objectContaining({ page: 1 })
    )
    expect(result.items).toHaveLength(1)
  })
})
