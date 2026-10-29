import { parseErpPage } from '../parsers.js'
import {
  EmptyResponseError,
  InvalidResponseError,
  PropertyNotSelectedError,
  ValidationError,
} from '../errors.js'
import { endpointInfo } from './registry.js'
import { BODY_SNIPPET_LENGTH } from '../client.js'
import { paginate, collectPages, endOfPages } from '../helpers/paginate.js'
import { atLeastInstance, callOptions } from '../callOptions.js'
import { SELECTION } from '../selectionMark.js'
import { checkPositiveInt } from '../validate.js'

const PAGE_OPTIONS = new Set([
  'page',
  'from',
  'to',
  'dateParam',
  'extraParams',
  'allowEmpty',
  'signal',
  'timeoutMs',
  'propertyId',
])
// A paginação inteira aceita as opções de uma página, trocando `page` pelas
// de percurso (a página inicial vira startPage).
const ALL_OPTIONS = new Set([
  ...[...PAGE_OPTIONS].filter((k) => k !== 'page'),
  'startPage',
  'maxPages',
  'delayMs',
  'onPage',
])

// Por que propertyId não serve para cada escopo (ver registry.js).
const SCOPE_REFUSAL = {
  contract: 'devolve a conta inteira, qualquer que seja a fazenda selecionada',
  global: 'ignora a fazenda selecionada (a resposta é a mesma para todas)',
  leaks:
    'devolve registros de outras fazendas mesmo com uma selecionada — atribua a fazenda pelo campo de cada registro',
}

// Resposta da leitura compartilhada quando a fazenda selecionada não é a pedida.
const MISMATCH = Symbol('mismatch')

// Uma chave fora da lista era descartada sem aviso (ex.: getContatos({ nome })
// devolvia a lista inteira, e quem chamou achava que tinha filtrado).
// Grids cujo filtro de data o servidor ignora (dateParam null no registro)
// recusam from/to: aceitar calado faria quem chama acreditar que recebeu só a
// janela pedida. Um dateParam explícito de quem chama troca o do registro
// (ex.: para testar outro nome de filtro). propertyId só vale onde o escopo
// pode ser por fazenda.
function checkOptions(options, allowed, info) {
  const { slug } = info
  const dateParam = options.dateParam === undefined ? info.dateParam : options.dateParam
  if (dateParam === null && (options.from !== undefined || options.to !== undefined)) {
    throw new ValidationError(
      `${slug}: a API MultBovinos ignora o filtro de data deste endpoint — from/to ` +
        'não reduziriam o resultado. Pagine o conjunto inteiro e filtre no cliente.',
      { field: 'from/to', received: { from: options.from, to: options.to } }
    )
  }
  const unknown = Object.keys(options).filter((k) => !allowed.has(k))
  if (unknown.length > 0) {
    throw new ValidationError(
      `${slug}: opção desconhecida (${unknown.join(', ')}). Filtros do servidor vão em ` +
        `extraParams; opções aceitas: ${[...allowed].join(', ')}`,
      { field: unknown[0], received: unknown }
    )
  }
  if (options.propertyId !== undefined) {
    checkPositiveInt(options.propertyId, 'propertyId')
    const why = SCOPE_REFUSAL[info.scope]
    if (why) {
      throw new ValidationError(`${slug}: propertyId não se aplica — o endpoint ${why}.`, {
        field: 'propertyId',
        received: options.propertyId,
      })
    }
  }
}

// Num grid por fazenda cujo registro traz a fazenda (recordPropertyField no
// registro), um registro de outra fazenda quer dizer que a seleção mudou no
// servidor durante a leitura — a seleção vale por usuário, então outra sessão
// com a mesma conta (outro processo, outra máquina) pode trocá-la sem esta
// instância saber. A fila desta instância não protege contra isso.
function checkRecordProperty(info, items, selected) {
  const field = info.recordPropertyField
  const foreign = items.find((item) => item[field] != null && Number(item[field]) !== selected)
  if (foreign === undefined) return
  throw new PropertyNotSelectedError(
    `${info.slug}: a página trouxe registros da fazenda ${foreign[field]}, mas a fazenda ` +
      `selecionada era ${selected}. Outra sessão com a mesma conta trocou a fazenda no ` +
      'servidor: não rode dois processos com a mesma conta ao mesmo tempo.',
    {
      endpoint: info.slug,
      reason: 'changed_by_another_session',
      propertyId: selected,
      received: foreign[field],
    }
  )
}

export class ErpGrid {
  #client
  #auth
  #verifyRecordProperty

  // auth (opcional nos testes): cada página roda numa leitura compartilhada
  // da fila de fazenda — nunca ao mesmo tempo que uma troca de fazenda.
  // verifyRecordProperty (padrão true): ver checkRecordProperty.
  constructor(client, auth, { verifyRecordProperty = true } = {}) {
    this.#client = client
    this.#auth = auth
    this.#verifyRecordProperty = verifyRecordProperty
  }

  // Baixa uma única página com parse BR aplicado automaticamente.
  // Retorna { items, count, hasMore, nextPage, filters, modelo } — filters é a
  // declaração de filtros que o servidor manda junto (nome e tipo), modelo o
  // nome do modelo no servidor.
  //
  // allowEmpty: quando true, EmptyResponseError (possível limite silencioso de
  // requisições) é capturado e retorna { items:[], count:0, hasMore:false,
  // nextPage:null, possiblyRateLimited:true, reason:'possibly_rate_limited' }
  // em vez de lançar. É escolha de quem chama: nenhum método do SDK liga isso
  // por conta própria, porque "este endpoint costuma vir vazio" depende da conta.
  //
  // dateParam: nome do filtro de data que o servidor aplica — from/to viram
  // `${dateParam}_0/_1`. O padrão vem do registro (registry.js): 'data' na
  // maioria dos grids, o nome próprio nos de filtro aninhado (ex.: tratositem
  // → movimentacao_material__data). Quem chama pode trocar, ex.: para testar
  // um grid cujo filtro ainda não foi verificado.
  //
  // propertyId: lê a página com essa fazenda selecionada. Se ela já é a
  // selecionada, a leitura é compartilhada; senão, seleção e leitura rodam na
  // mesma seção exclusiva. Endpoint de escopo desconhecido devolve também
  // scope: 'unverified' (o filtro por fazenda não foi confirmado); escopo de
  // conta, global ou que vaza recusa com ValidationError. Sem propertyId, um
  // grid sabidamente por fazenda exige fazenda já selecionada.
  //
  // timeoutMs: prazo só desta página (padrão: o do registro, se houver; senão
  // o da instância).
  //
  // Com auth, o resultado leva a marca SELECTION (ver selectionMark.js): a
  // geração da fazenda selecionada lida dentro da seção, com que o paginate()
  // detecta uma troca de fazenda entre duas páginas.
  async fetchPage(slug, options = {}) {
    const info = endpointInfo(slug)
    checkOptions(options, PAGE_OPTIONS, info)
    const {
      page = 1,
      from,
      to,
      dateParam = info.dateParam,
      extraParams = {},
      allowEmpty = false,
      signal,
      timeoutMs = this.#suggestedTimeout(info),
      propertyId,
    } = options
    // extraParams por último: page é um parâmetro nomeado explícito e nunca
    // deve ser sobrescrito silenciosamente por um extraParams.page acidental.
    const params = { ...extraParams, page }
    if (from) params[`${dateParam}_0`] = from
    if (to) params[`${dateParam}_1`] = to

    const perCall = callOptions({ signal, timeoutMs })
    const request = () =>
      Object.keys(perCall).length > 0
        ? this.#client.get(`/${slug}/`, params, perCall)
        : this.#client.get(`/${slug}/`, params)

    let read
    try {
      read = await this.#read(info, propertyId, request, signal)
    } catch (err) {
      if (allowEmpty && err instanceof EmptyResponseError) {
        return {
          items: [],
          count: 0,
          hasMore: false,
          nextPage: null,
          possiblyRateLimited: true,
          reason: 'possibly_rate_limited',
        }
      }
      throw err
    }
    const { raw, generation, selected } = read

    // Uma página de grid sempre traz a lista results. Sem ela (ex.: uma limitação do
    // servidor fora do formato { detail } puro), tratar como lista vazia faria a
    // paginação parecer terminada — e um apagar-e-recarregar perderia dados.
    if (raw === null || typeof raw !== 'object' || !Array.isArray(raw.results)) {
      throw new InvalidResponseError(`Resposta do grid ${slug} sem a lista "results"`, {
        statusCode: 200,
        slug,
        bodySnippet: String(JSON.stringify(raw)).slice(0, BODY_SNIPPET_LENGTH),
      })
    }

    const parsed = parseErpPage(raw)
    if (
      this.#verifyRecordProperty &&
      info.scope === 'property' &&
      info.recordPropertyField !== null &&
      selected != null
    ) {
      checkRecordProperty(info, parsed.results, selected)
    }
    const result = {
      items: parsed.results,
      count: parsed.count ?? 0,
      hasMore: !!parsed.links?.next,
      nextPage: parsed.links?.next ? page + 1 : null,
      filters: raw.filters ?? null,
      modelo: raw.modelo ?? null,
    }
    if (propertyId !== undefined && info.scope === 'unknown') result.scope = 'unverified'
    // A página vazia do allowEmpty (acima) não leva a marca: ela só vale para
    // a primeira página e encerra a paginação (hasMore: false).
    if (this.#auth) {
      Object.defineProperty(result, SELECTION, { value: { generation, slug } })
    }
    return result
  }

  // Prazo sugerido pelo registro, que nunca encurta o prazo da instância.
  #suggestedTimeout(info) {
    if (info.timeoutMs === undefined) return undefined
    return atLeastInstance(info.timeoutMs, this.#client)
  }

  // Lê uma página na seção certa da fila de fazenda e devolve { raw,
  // generation, selected } (selected: a fazenda com que a página foi lida).
  // Com propertyId a página é lida com aquela fazenda de forma atômica, então
  // a marca da página é a própria fazenda (não a geração): coletas paralelas
  // de fazendas diferentes se alternam, mas nenhuma página sai misturada.
  async #read(info, propertyId, request, signal) {
    const auth = this.#auth
    if (!auth) {
      if (propertyId !== undefined) {
        throw new ValidationError('propertyId exige uma sessão (use mb.erp)', {
          field: 'propertyId',
        })
      }
      return { raw: await request(), generation: undefined, selected: undefined }
    }
    // Um relogin em andamento zera a fazenda até reselecionar: espera ele
    // terminar para não confundir "sem fazenda" com "outra fazenda".
    await auth.pendingRelogin()?.catch(() => {})
    const mark = (generation) => (propertyId === undefined ? generation : `property:${propertyId}`)
    // Dentro da seção nenhuma troca de fazenda roda, então a geração lida ali
    // vale para a resposta inteira desta página.
    const out = await auth.shared(async () => {
      const selected = auth.getSelectedPropertyId()
      if (propertyId !== undefined && selected !== propertyId) return MISMATCH
      if (propertyId === undefined && info.scope === 'property' && selected === null) {
        throw new PropertyNotSelectedError(
          `${info.slug} é por fazenda: chame selectProperty() antes ou passe { propertyId }`,
          { endpoint: info.slug }
        )
      }
      const generation = mark(auth.getSelectionGeneration())
      return { raw: await request(), generation, selected }
    })
    if (out !== MISMATCH) return out
    return auth.withProperty(
      this.#client,
      propertyId,
      async () => ({ raw: await request(), generation: mark(), selected: propertyId }),
      { signal }
    )
  }

  // Iterador assíncrono das páginas de um grid (ver helpers/paginate.js):
  // cada passo devolve o resultado do fetchPage mais `page`. Resposta vazia
  // depois da primeira página lança EmptyResponseError; allowEmpty só vale
  // para a primeira. Uma troca de fazenda entre duas páginas lança
  // PropertyNotSelectedError (a guarda fica no paginate, pela marca do
  // fetchPage). delayMs (padrão 0): espera entre páginas — o cliente não
  // espaça chamadas por conta própria; quem consome decide.
  pages(slug, options = {}) {
    checkOptions(options, ALL_OPTIONS, endpointInfo(slug))
    const { startPage = 1, ...rest } = options
    delete rest.onPage // usado só pelo fetchAll
    return paginate((p) => this.fetchPage(slug, p), { ...rest, page: startPage })
  }

  // Itera todas as páginas, chamando onPage(items, pageNum) a cada lote.
  // Para quando: não há próxima página, maxPages atingido, ou onPage retornar false.
  //
  // Resultado: { totalFetched, pagesRead, stoppedAt, complete, nextPage, possiblyRateLimited }
  //   complete: true só quando o servidor disse que não havia mais páginas —
  //     false quando maxPages ou onPage interromperam, ou quando a primeira
  //     página veio vazia com allowEmpty; aí nextPage é a página de onde retomar
  //   possiblyRateLimited: a primeira página veio vazia com allowEmpty — a
  //     janela pode estar vazia de verdade ou ser limite silencioso de
  //     requisições
  //   scope: 'unverified' quando propertyId foi usado num endpoint de escopo desconhecido
  // Opções validadas por pages().
  async fetchAll(slug, options = {}) {
    const { onPage } = options
    let pagesRead = 0
    let totalFetched = 0
    let stoppedAt = null
    let last

    for await (const result of this.pages(slug, options)) {
      pagesRead++
      totalFetched += result.items.length
      last = result
      if (onPage && (await onPage(result.items, result.page)) === false) {
        stoppedAt = result.page
        break
      }
    }

    return { totalFetched, pagesRead, stoppedAt, ...endOfPages(last, stoppedAt !== null) }
  }

  // Todas as páginas juntas, em memória: { items, pagesRead, complete,
  // nextPage, possiblyRateLimited, scope? }. Mesmas opções de pages().
  async collect(slug, options = {}) {
    return collectPages(this.pages(slug, options))
  }

  // Busca por id de endpoint cuja LISTAGEM está quebrada ou não-filtrável — padrão
  // descoberto no confinamento e repetido em
  // movimentacaomaterial/entidaderegradereplicacao/movimentacaomaterialitem.
  // O registro individual responde JSON cru, sem o envelope do
  // grid — por isso sem parseErpPage. O formato de data varia por endpoint
  // (confinamento: ISO; movimentacaomaterialitem: BR "DD/MM/YYYY") — cada
  // método consumidor documenta o seu. Valida o id ANTES da requisição para
  // o erro sair informativo e sem custo de rede.
  async fetchOneJson(slug, id, methodName) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError(`${methodName} exige um id inteiro positivo`, {
        field: 'id',
        received: id,
      })
    }
    const request = () => this.#client.get(`/${slug}/${id}/`, { format: 'json' })
    // Leitura compartilhada: a busca não cai no meio de uma troca de fazenda
    // (a resposta é da fazenda da sessão; outra fazenda responde 404).
    return this.#auth ? this.#auth.shared(request) : request()
  }

  async create(slug, body) {
    return this.#client.post(`/${slug}/`, body)
  }

  async update(slug, id, body) {
    return this.#client.put(`/${slug}/${id}/`, body)
  }

  async patch(slug, id, body) {
    return this.#client.patch(`/${slug}/${id}/`, body)
  }
}
