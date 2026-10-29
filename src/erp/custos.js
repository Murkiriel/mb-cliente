import { CUSTO_PATHS } from '../constants.js'
import { ValidationError } from '../errors.js'
import { checkTimeout } from '../validate.js'
import { atLeastInstance } from '../callOptions.js'

// Cálculo pesado no servidor (de segundos a alguns minutos): prazo padrão de
// 300 s em todo método de custos — ou o timeoutMs da instância, se for maior.
const COST_TIMEOUT_MS = 300_000

export class CustosErp {
  #client
  #auth

  constructor(client, auth) {
    this.#client = client
    this.#auth = auth
  }

  // Com propertyId, todo método seleciona a fazenda e faz o POST na mesma
  // seção exclusiva (Auth.inProperty → withProperty): chamadas paralelas na
  // mesma instância rodam uma de cada vez, sem uma ler a fazenda da outra, e
  // o corpo leva `propriedade`. Sem propertyId (só onde é opcional), o POST
  // entra na fila como leitura compartilhada, para não cair no meio de uma
  // troca de fazenda — sem exigir fazenda selecionada: sem propriedade, o
  // endpoint vale para o contrato inteiro. Depois da chamada, a fazenda
  // selecionada é a do propertyId.
  // unwrap: desembrulha o envelope { dados } quando vem (o custo indireto
  // devolve a resposta como veio).
  // timeoutMs: prazo só desta chamada (padrão: COST_TIMEOUT_MS ou o da
  // instância, o que for maior).
  async #post(
    path,
    body,
    propertyId,
    { unwrap = true, timeoutMs = atLeastInstance(COST_TIMEOUT_MS, this.#client) } = {}
  ) {
    // O HttpClient também valida o prazo, mas só depois que a fila trocou a
    // fazenda no servidor: validar antes evita uma troca à toa.
    checkTimeout(timeoutMs)
    // Nos métodos em que propertyId é obrigatório o corpo já traz
    // `propriedade` na primeira posição; reatribuir não muda a ordem.
    if (propertyId != null) body.propriedade = propertyId
    const data = await this.#auth.inProperty(
      this.#client,
      propertyId,
      `erp.custos (${path})`,
      () => this.#client.post(`/${path}/`, body, { timeoutMs }),
      { requireSelection: false }
    )
    return unwrap ? (data?.dados ?? data) : data
  }

  // Custos de animais PRESENTES no rebanho.
  // referenceDate: YYYY-MM-DD, nunca no futuro — use ontem (o último dia que o
  // MBWEB já fechou). Uma data futura estoura o prazo ou devolve HTTP 400.
  // fromDate: opcional — restringe ao intervalo fromDate→referenceDate
  async getCustosAtivos({ propertyId, referenceDate, fromDate, timeoutMs } = {}) {
    if (!propertyId || !referenceDate) {
      throw new ValidationError('propertyId e referenceDate são obrigatórios', {
        field: 'propertyId/referenceDate',
        received: { propertyId, referenceDate },
      })
    }
    const body = { propriedade: propertyId, data: referenceDate }
    if (fromDate) body.data_inicio = fromDate
    return this.#post(CUSTO_PATHS.ATIVOS, body, propertyId, { timeoutMs })
  }

  // Custos de animais VENDIDOS em um período.
  // from/to: YYYY-MM-DD
  async getCustosVendidos({ propertyId, from, to, timeoutMs } = {}) {
    if (!propertyId || !from || !to) {
      throw new ValidationError('propertyId, from e to são obrigatórios', {
        field: 'propertyId/from/to',
        received: { propertyId, from, to },
      })
    }
    return this.#post(
      CUSTO_PATHS.VENDIDOS,
      { propriedade: propertyId, data_inicio: from, data_fim: to },
      propertyId,
      { timeoutMs }
    )
  }

  // Custos de animais MORTOS em um período.
  async getCustosMortos({ propertyId, from, to, timeoutMs } = {}) {
    if (!propertyId || !from || !to) {
      throw new ValidationError('propertyId, from e to são obrigatórios', {
        field: 'propertyId/from/to',
        received: { propertyId, from, to },
      })
    }
    return this.#post(
      CUSTO_PATHS.MORTOS,
      { propriedade: propertyId, data_inicio: from, data_fim: to },
      propertyId,
      { timeoutMs }
    )
  }

  // Saldo do ativo biológico (CPC 29).
  // referenceDate: dia 01 do mês de referência (ex.: '2026-06-01')
  // propertyId: opcional — sem = todas as propriedades do contrato
  // ATENÇÃO: valores vêm zerados até pré-configuração no painel MB:
  //   Categorias → multiplicador "por peso @"
  //   Financeiro → Cotações Diárias (arroba macho/fêmea)
  //   Custos → Configurações (% imposto)
  async getSaldoBiologico({ propertyId, referenceDate, timeoutMs } = {}) {
    if (!referenceDate) {
      throw new ValidationError('referenceDate é obrigatório', {
        field: 'referenceDate',
        received: referenceDate,
      })
    }
    return this.#post(CUSTO_PATHS.SALDO_BIOLOGICO, { data: referenceDate }, propertyId, {
      timeoutMs,
    })
  }

  // Envia custo indireto (rateia entre os animais presentes no último dia do mês).
  // referenceMonth: sempre dia 01 (ex.: '2026-06-01'), enviado como mes_referencia
  // amount: valor a ratear, enviado como valor
  // propertyId: opcional — sem = rateia entre TODOS os animais do contrato
  // conta: fixo -2 (definido pela API)
  async sendCustoIndireto({ propertyId, referenceMonth, amount, timeoutMs } = {}) {
    if (!referenceMonth || amount === undefined) {
      throw new ValidationError('referenceMonth e amount são obrigatórios', {
        field: 'referenceMonth/amount',
        received: { referenceMonth, amount },
      })
    }
    return this.#post(
      CUSTO_PATHS.INDIRETO,
      { mes_referencia: referenceMonth, valor: amount, conta: -2 },
      propertyId,
      { unwrap: false, timeoutMs }
    )
  }

  // Busca saídas de material por data e tipo. Sem paginação/intervalo — 1
  // chamada = 1 dia + 1 tipo só, então sincronizar tudo exigiria dias × 14
  // tipos × propriedades chamadas (inviável pra carga histórica).
  // date: YYYY-MM-DD (enviado como data)
  // tipoSaida: usar constante TIPO_SAIDA_MATERIAL.*
  //
  // ⚠️ NUTRICIONAL_CONFINAMENTO/PRODUCAO_RACAO/TRATAMENTO_ANIMAIS aqui são a
  // MESMA informação já disponível via getTratos()/bi.producaoRacao.get()/
  // getTratamentos(). Ou seja, apesar de ser a alternativa
  // recomendada pra getMovimentacaoMaterial() (❌ HTTP 500), pelo menos
  // esses 3 tipos não trazem dado novo pra quem já sincroniza os endpoints
  // de domínio -- só um recorte redundante pela ótica de custo/material.
  // Os demais tipos (VENDA, PERDA, AJUSTE_INVENTARIO etc.) não foram
  // verificados; podem ter conteúdo não coberto por outros endpoints.
  async getSaidasMaterial({ propertyId, date, tipoSaida, timeoutMs } = {}) {
    if (!date || tipoSaida === undefined) {
      throw new ValidationError('date e tipoSaida são obrigatórios', {
        field: 'date/tipoSaida',
        received: { date, tipoSaida },
      })
    }
    return this.#post(
      CUSTO_PATHS.BUSCAR_SAIDAS,
      { data: date, tipo_saida: tipoSaida },
      propertyId,
      {
        timeoutMs,
      }
    )
  }
}
