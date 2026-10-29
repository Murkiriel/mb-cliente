import type { ErpPage, ErpPageResult, FetchPageOptions } from '../../index.js'

// Helpers — exportados na raiz e em `/helpers`.

export interface SafeImportOptions<T = unknown> {
  /** Devolve os itens, ou `{ items, complete }` — `complete: false` preserva os dados locais. */
  fetch: () => Promise<
    T[] | { items: T[]; complete?: boolean; possiblyRateLimited?: boolean } | null | undefined
  >
  /** Troca os dados locais pelos novos. Deve ser TRANSACIONAL (apagar e inserir
   * na mesma transação): se falhar no meio, os dados antigos ficam intactos. */
  replace: (items: T[]) => Promise<void> | void
  onRateLimit?: (err: Error) => Promise<void> | void
}

export interface SafeImportResult {
  preserved: boolean
  reason?:
    | 'rate_limit_explicit'
    | 'empty_response_possibly_rate_limited'
    | 'incomplete'
    | 'legitimately_empty'
  inserted?: number
}

export interface PaginateOptions extends Omit<FetchPageOptions, 'page'> {
  /** Página inicial (padrão 1). */
  page?: number
  maxPages?: number
  /** Espera entre páginas, em ms (padrão 0). Interrompida pelo `signal`. */
  delayMs?: number
  [param: string]: unknown
}

/** Resultado de {@link collectPages} e de `mb.erp.collect()`. */
export interface CollectResult<T = Record<string, unknown>> {
  items: T[]
  pagesRead: number
  /** true só quando a última página lida disse que não havia mais. */
  complete: boolean
  /** De onde retomar quando `complete` é false. */
  nextPage: number | null
  possiblyRateLimited: boolean
  scope?: 'unverified'
}

export interface DateWindow {
  from: string
  to: string
}

export declare function safeImport<T = unknown>(
  options: SafeImportOptions<T>
): Promise<SafeImportResult>

/**
 * Itera as páginas de qualquer método de página única do ERP:
 * `for await (const { items, page } of paginate((p) => mb.erp.cadastros.getMateriais(p), { from }))`.
 * Termina quando não há próxima página, em `maxPages` ou num `break`. Resposta vazia depois
 * da primeira página lança `EmptyResponseError`; `allowEmpty` só vale para a primeira.
 * @throws {PropertyNotSelectedError} (`reason: 'changed_during_pagination'`) se a fazenda
 *   selecionada mudar entre duas páginas de um grid ERP — a página da outra fazenda não é entregue.
 */
export declare function paginate<T = Record<string, unknown>>(
  fetchPage: (params: FetchPageOptions) => Promise<ErpPageResult<T>>,
  params?: PaginateOptions
): AsyncGenerator<ErpPage<T>>

/** Junta em memória todas as páginas de `paginate()`, `iter*()` ou `mb.erp.pages()`. */
export declare function collectPages<T = Record<string, unknown>>(
  pages: AsyncIterable<ErpPage<T>>
): Promise<CollectResult<T>>

export declare function getWeeklyWindows(from: string, to: string, days?: number): DateWindow[]
export declare function getMonthlyWindows(from: string, to: string): DateWindow[]
export declare function lastDayOfMonth(yearMonth: string): string
export declare function firstDayOfMonth(yearMonth: string): string
