import { ERP_SLUGS } from '../constants.js'

export class AnimaisErp {
  #grid
  #client

  constructor(grid, client) {
    this.#grid = grid
    this.#client = client
  }

  // Fluxo de entrada de animais em dois passos:
  //
  // Passo 1: buscar a entrada pelo número da ordem de serviço do MB Curral.
  // Retorna o id da entrada para usar no passo 2.
  async findByOrdemServico(ordemServico) {
    return this.#client.post(`/${ERP_SLUGS.ENTRADA}/obtenha/`, { ordem_servico: ordemServico })
  }

  // Passo 2: atualizar os dados financeiros da entrada encontrada no passo 1.
  // body: { data_aquisicao, fornecedor?, fornecedor_leilao?, fornecedor_corretor?,
  //         fornecedor_frete?, fornecedor_outras_despesas?, forma_pagamento?,
  //         total_animais?, valor_leilao?, valor_corretor?, valor_frete?,
  //         valor_outros?, valor_compra? }
  async updateEntradaFinanceiro(id, body) {
    return this.#client.put(`/${ERP_SLUGS.ENTRADA}/${id}/`, body)
  }

  // ⚠️ Filtro from/to CONFIRMADO IGNORADO pelo servidor (mesmo padrão de
  // getGtas() em erp/estoque.js) — testado: 3 janelas
  // bem diferentes (recente, antiga, sem filtro) devolveram os mesmos
  // registros/ids/count. Consumidores devem paginar
  // o período inteiro (como getGtas()), nunca depender de from/to aqui.
  async getSaidas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.SAIDA, params)
  }

  // ATENÇÃO: campos financeiros (valor_total, valor_pagamento, media_arroba)
  // vêm ZERADOS na origem nesta API. Para receita real de venda, usar
  // bi.movEstoque.get() (campo valor_total nas saídas).
  async getVendas(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.VENDA, params)
  }

  async getMortes(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.MORTE, params)
  }

  // Endpoints adicionais. Juntos formam um histórico de movimentação de local por animal — bem mais
  // granular que os campos localizacao/localizacao_anterior (só
  // "atual + anterior") de bi.animais.get().
  //
  // Confinamento: movimentação entre currais/baias dentro do confinamento.
  // TESTADO: from/to (data_0/data_1) NÃO reduz o count (mesmo total com ou
  // sem filtro) — mesmo problema de estoque.getMovimentacaoMaterialItens().
  // Período inteiro inviável por enquanto.
  async getHistoricoMovimentacaoConfinamento(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.HISTORICO_MOVIMENTACAO_CONFINAMENTO, params)
  }

  // Localidades: movimentação entre pastos/localidades (fora do confinamento).
  // TESTADO: from/to FUNCIONA de verdade (uma janela de 7 dias reduz o
  // total em ordens de grandeza) — viável para sincronização incremental por data.
  async getHistoricoMovimentacaoLocalidades(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.HISTORICO_MOVIMENTACAO_LOCALIDADES, params)
  }

  // Lotes de confinamento, 10 por página, cada um com o array animais[] —
  // páginas pesadas (de 4 a 17 s na sonda de 2026-10-29). Por fazenda. O
  // filtro de data que o servidor aplica é data_abertura (o registro já usa
  // esse nome: from/to filtram pela abertura do lote; 'data' é ignorado).
  // A listagem respondia HTTP 500 até 2026-10; a sonda de 2026-10-29 a
  // encontrou funcionando. Os números passam pelo parse BR — diferente de
  // getConfinamentoById, que devolve o JSON cru (decimais como texto com
  // ponto, e null onde a listagem traz 0).
  async getConfinamento(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.CONFINAMENTO, params)
  }

  // ✅ A busca por id de confinamento FUNCIONA (confirmado: GET
  // confinamento/{id}/). Retorna o lote completo (data_abertura/data_saida,
  // gpd, gpt, mortes, vendas, saldo, ~121 campos) incluindo o array
  // `animais[]` com o ciclo POR ANIMAL: data_entrada/data_saida,
  // peso_entrada/data_peso_entrada, ultimo_peso, permanencia(_conf) e o
  // motivo de saída via FKs (venda_item_id, descarte_id, saida_id,
  // transferencia_*_id) — equivalente da tabela CONFINAMENTOS_ANIMAIS do
  // MBDT desktop.
  //
  // ⚠️ Escopado pela propriedade da SESSÃO: id de lote de outra fazenda
  // responde 404 — chame selectProperty() da fazenda dona antes. Lotes
  // FECHADOS continuam acessíveis (um lote encerrado responde
  // completo). Ids são descobríveis pelo campo
  // `confinamento` dos itens de sobra de cocho (erp.estoque.getSobraCocho).
  //
  // A resposta já vem em JSON limpo (datas ISO, números nativos) — não passa
  // pelo formato BR do grid, então não aplica parseErpRecord.
  async getConfinamentoById(id) {
    return this.#grid.fetchOneJson(ERP_SLUGS.CONFINAMENTO, id, 'getConfinamentoById')
  }

  // Eventos de contagem/inventário de rebanho (auditoria física do
  // rebanho). Endpoint adicional.
  async getInventariosAnimais(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.INVENTARIO_ANIMAIS, params)
  }

  // ⭐ Endpoint adicional. PESAGEM REAL POR ANIMAL.
  // Substitui, na prática, a pesagem do BI (❌ timeout permanente, não exposta) e
  // pesagemmedicao (❌ sem endpoint REST, é integração externa).
  //
  // Campos incluem: animal, animal_texto, sisbov, valor (peso), data_avaliacao,
  // idade_na_pesagem, localidade_texto, lote_alimentar_texto, propriedade,
  // propriedade_texto.
  //
  // ⚠️ ESCOPO: selectProperty() NÃO restringe corretamente por propriedade:
  // a resposta traz animais de outras propriedades do MESMO contrato. Cada
  // registro, porém, traz o próprio campo `propriedade`/`propriedade_texto`
  // correto — o endpoint é seguro de usar, desde que a propriedade seja
  // atribuída por esse campo de cada registro, nunca pela fazenda
  // selecionada na sessão.
  //
  // ⚠️ MAS: from/to e propriedade= como parâmetro NÃO filtram (mesmo count
  // com ou sem) — o escopo vem só da sessão (selectProperty), não de query
  // params. Sem filtro incremental por data, uma sincronização completa precisa
  // paginar tudo (muitas páginas numa fazenda grande, a
  // 10 registros por página) — pesado, mas real e correto.
  async getMedicoesPesagem(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.MEDICOES_PESAGEM, params)
  }

  // Endpoints adicionais — identificação/ciclo de vida SISBOV.
  async getAlteracoesSisbov(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ANIMAL_ALTERACAO_SISBOV, params)
  }
  async getReidentificacoesSisbov(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ANIMAL_REIDENTIFICADO_SISBOV, params)
  }
  async getAnimaisDesmamados(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.ANIMAL_DESMAMADO, params)
  }
  async getRecepcoesAnimais(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.RECEPCAO_ANIMAIS, params)
  }
  async getMotivosDescarteReprodutor(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.MOTIVO_DESCARTE_REPRODUTOR, params)
  }
  async getTiposMorte(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.TIPO_MORTE, params)
  }

  // Mesma contagem do cadastro de animais — parece ser um apelido/view dele,
  // mas não está confirmado qual o filtro (o nome sugere "machos", porém a
  // contagem bate com TODOS os animais). Prefira bi.animais.get() como fonte
  // primária até esclarecer a diferença real.
  //
  // ERP_SLUGS.MBIVF_WEB_MACHO ('mbivfwebmacho') tem a mesma contagem e forma
  // — provável segundo apelido (contexto "MB IVF"/genética) do mesmo dado.
  // Não embrulhado em método próprio para não duplicar API por uma diferença
  // ainda não esclarecida; o slug já está documentado em constants.js.
  async getMachos(params = {}) {
    return this.#grid.fetchPage(ERP_SLUGS.MACHO, params)
  }
}
