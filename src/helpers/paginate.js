import { PropertyNotSelectedError } from '../errors.js'
import { sleep } from '../sleep.js'
import { SELECTION } from '../selectionMark.js'
import { checkNonNegative, checkPositiveInt } from '../validate.js'

// Itera as páginas de qualquer método de página única do SDK
// (fetchPage → { items, count, hasMore, nextPage }):
//
//   for await (const { items, page } of paginate((p) => mb.erp.cadastros.getMateriais(p), { from })) …
//
// Termina quando o servidor diz que não há próxima página, ao atingir
// maxPages ou quando quem consome sai do laço (break). Uma resposta vazia
// DEPOIS da primeira página nunca é legítima (o servidor tinha anunciado mais
// páginas): ela propaga como EmptyResponseError, mesmo com allowEmpty — que
// só vale para a primeira página (janela que pode estar vazia de verdade).
//
// Uma troca de fazenda entre duas páginas de grid ERP misturaria fazendas na
// mesma coleta (os grids por sessão respondem pela fazenda selecionada): a
// página que vier com outra geração de seleção (marca SELECTION, posta pelo
// grid) lança PropertyNotSelectedError ANTES de ser entregue.
//
// params: os do método (from, to, extraParams…), mais
//   page      página inicial (padrão 1)
//   maxPages  limite de páginas (padrão sem limite)
//   delayMs   espera entre páginas (padrão 0); interrompida pelo signal
//   allowEmpty, signal — repassados ao método
export async function* paginate(fetchPage, params = {}) {
  const {
    page: startPage = 1,
    maxPages = Infinity,
    delayMs = 0,
    allowEmpty,
    signal,
    ...rest
  } = params
  checkPositiveInt(startPage, 'page')
  if (maxPages !== Infinity) checkPositiveInt(maxPages, 'maxPages')
  checkNonNegative(delayMs, 'delayMs')

  let page = startPage
  let generation
  for (let read = 0; read < maxPages; read++) {
    if (read > 0 && delayMs > 0) await sleep(delayMs, signal)
    const call = { ...rest, page }
    if (signal) call.signal = signal
    if (allowEmpty && read === 0) call.allowEmpty = true
    const result = await fetchPage(call)
    const mark = result[SELECTION]
    if (mark) {
      if (generation === undefined) generation = mark.generation
      else if (mark.generation !== generation) {
        throw new PropertyNotSelectedError(
          `A fazenda selecionada mudou durante a paginação de ${mark.slug}: as páginas ` +
            'seguintes viriam de outra fazenda. Não mude de fazenda (selectProperty, getAll, ' +
            'forAllProperties, erp.custos) enquanto pagina.',
          { endpoint: mark.slug, reason: 'changed_during_pagination' }
        )
      }
    }
    yield { ...result, page }
    if (!result.hasMore) return
    page++
  }
}

// Como terminou uma paginação, a partir da última página lida (interno, usado
// por collectPages e pelo fetchAll do grid): { complete, nextPage,
// possiblyRateLimited, scope? }. complete é true só quando essa página disse
// que não havia mais (hasMore false), ninguém interrompeu (stopped) e ela não
// veio vazia pelo allowEmpty; senão, nextPage diz de onde retomar.
export function endOfPages(last, stopped = false) {
  // Primeira página vazia absorvida pelo allowEmpty: pode ser limite
  // silencioso de requisições — não é "completo", e retoma da mesma página.
  const rateLimited = last?.possiblyRateLimited === true
  const complete = !stopped && !last?.hasMore && !rateLimited
  const end = {
    complete,
    nextPage: complete ? null : rateLimited ? last.page : last.page + 1,
    possiblyRateLimited: rateLimited,
  }
  if (last?.scope) end.scope = last.scope
  return end
}

// Junta em memória todas as páginas de um iterador (paginate, iter*, pages):
// { items, pagesRead, complete, nextPage, possiblyRateLimited, scope? } (ver
// endOfPages).
export async function collectPages(pages) {
  const items = []
  let pagesRead = 0
  let last = null
  for await (const result of pages) {
    items.push(...result.items)
    pagesRead++
    last = result
  }
  return { items, pagesRead, ...endOfPages(last) }
}
