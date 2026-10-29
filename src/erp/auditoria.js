import { ERP_SLUGS } from '../constants.js'
import { EndpointUnavailableError } from '../errors.js'

// Endpoints adicionais (fora do manual oficial) — nenhuma tela do MBWEB os
// expõe diretamente.
export class AuditoriaErp {
  #grid
  #client

  constructor(grid, client) {
    this.#grid = grid
    this.#client = client
  }

  // Trilha de auditoria completa do sistema: quem mudou o quê, quando, e o
  // valor antes/depois (campos conteudo_anterior/conteudo_novo). Volume
  // muito grande.
  //
  // from/to (data_0/data_1) filtram de verdade — sempre use uma janela de
  // data pequena, nunca o período inteiro.
  async getAuditoria(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.AUDITORIA, params)
  }

  // Regras/alertas de validação do MBDT (desktop) — catálogo pequeno.
  async getRegrasDeReplicacao(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.REGRA_DE_REPLICACAO, params)
  }

  // ❌ A LISTAGEM retorna HTTP 500 (re-testado; mesma classe de
  // erro da listagem de movimentacaomaterial em estoque.js). MAS o registro
  // individual funciona — use getEntidadeRegraDeReplicacaoById().
  getEntidadeRegraDeReplicacao() {
    throw new EndpointUnavailableError(
      `${ERP_SLUGS.ENTIDADE_REGRA_DE_REPLICACAO} (listagem) retorna HTTP 500 — bug de serializador no servidor MB`,
      {
        slug: ERP_SLUGS.ENTIDADE_REGRA_DE_REPLICACAO,
        reason:
          'HTTP 500 na listagem — bug de serializador no servidor. A rota existe mas a listagem não funciona.',
        workaround:
          'getEntidadeRegraDeReplicacaoById(id) funciona — catálogo pequeno, ids sequenciais ' +
          '(buracos respondem 404), enumerável por inteiro.',
      }
    )
  }

  // ✅ A busca por id FUNCIONA (confirmado). Catálogo dos "tipos de
  // entidade" do sistema de replicação MBDT ({ id, uid, descricao, ... }).
  // Ids sequenciais a partir de 1, com buracos (404). JSON limpo, sem
  // formato BR.
  async getEntidadeRegraDeReplicacaoById(id) {
    return this.#grid.fetchOneJson(
      ERP_SLUGS.ENTIDADE_REGRA_DE_REPLICACAO,
      id,
      'getEntidadeRegraDeReplicacaoById'
    )
  }

  // ⚠️ Resposta vazia (EmptyResponseError) na primeira tentativa — não
  // confirmado se é limite silencioso de requisições ou se a tabela é legitimamente
  // pouco ativa. Quem chama decide se passa { allowEmpty: true }.
  async getLogDeReplicacao(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.LOG_DE_REPLICACAO, params)
  }

  // ⚠️ Mesma situação de getLogDeReplicacao.
  async getLogReplicacaoAnimaisNaoExcluidos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.LOG_REPLICACAO_ANIMAIS_NAO_EXCLUIDOS, params)
  }

  // Endpoint adicional. Configuração da conta: parâmetros de GMD/abate (peso_abate_inicial/final,
  // qnt_dias_peso, peso_entrada_considerado), rastreabilidade SISBOV,
  // integração ERP/pesagem externa, etc. 1 registro por contrato.
  async getConfiguracoesGerais(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONFIGURACOES_GERAIS, params)
  }

  // Endpoint adicional. Usuários do sistema (contas de acesso ao
  // MBWEB/MB Curral), com módulos liberados e propriedades vinculadas.
  async getUsuarios(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.USUARIO, params)
  }

  // ── Endpoints adicionais ───────────────────────────────────────────────────
  // Histórico/logs de sincronização entre desktop MBDT, apps móveis (MB
  // Curral, MB Tratos) e o servidor.

  async getHistoricoAcoesApp(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.HISTORICO_ACOES_APP, params)
  }
  async getHistoricoMovimentacaoLoteDeAvaliacao(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.HISTORICO_MOVIMENTACAO_LOTE_DE_AVALIACAO, params)
  }
  async getHistoricoMovimentacaoProgramaNutricional(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.HISTORICO_MOVIMENTACAO_PROGRAMA_NUTRICIONAL, params)
  }
  async getControleSincronizacaoCurral(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONTROLE_SINCRONIZACAO_CURRAL, params)
  }
  async getControleSincronizacaoMbTratos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONTROLE_SINCRONIZACAO_MBTRATOS, params)
  }
  async getCurralErrosExecucaoEvento(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CURRAL_ERROS_EXECUCAO_EVENTO, params)
  }
  async getEstatisticasRotinaEstoqueAnimalDetalhe(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ESTATISTICAS_ROTINA_ESTOQUE_ANIMAL_DETALHE, params)
  }

  // ❌ A LISTAGEM retorna HTTP 500 (re-testado). MAS a sub-rota
  // ultimos-itens-fila/ (usada pela própria interface web) e a
  // busca por id /{id}/ funcionam — use getHistoricoExecucaoViewPgUltimosItensFila().
  getHistoricoExecucaoViewPg() {
    throw new EndpointUnavailableError(
      `${ERP_SLUGS.HISTORICO_EXECUCAO_VIEW_PG} (listagem) retorna HTTP 500 — bug de serializador no servidor MB`,
      {
        slug: ERP_SLUGS.HISTORICO_EXECUCAO_VIEW_PG,
        reason:
          'HTTP 500 na listagem — bug de serializador no servidor. A rota existe mas a listagem não funciona.',
        workaround:
          'getHistoricoExecucaoViewPgUltimosItensFila() retorna as execuções recentes da fila; ' +
          'GET {slug}/{id}/ também responde para um registro específico.',
      }
    )
  }

  // ✅ Sub-rota ultimos-itens-fila/ FUNCIONA (confirmado). Retorna { dados: [...] } com as execuções recentes da fila
  // de atualização das views materializadas do servidor MB (data_agendamento,
  // inicio/fim_execucao, intervalo_execucao, status/status_texto) — útil para
  // saber QUANDO os dados agregados do servidor foram recalculados pela última
  // vez. JSON com datas ISO nos campos inicio/fim_execucao.
  async getHistoricoExecucaoViewPgUltimosItensFila() {
    return this.#client.get(`/${ERP_SLUGS.HISTORICO_EXECUCAO_VIEW_PG}/ultimos-itens-fila/`, {
      format: 'json',
    })
  }
}
