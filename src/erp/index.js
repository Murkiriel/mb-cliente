import { ErpGrid } from './grid.js'
import { CadastrosErp } from './cadastros.js'
import { AnimaisErp } from './animais.js'
import { SanitarioErp } from './sanitario.js'
import { EstoqueErp } from './estoque.js'
import { CustosErp } from './custos.js'
import { AuditoriaErp } from './auditoria.js'
import { FinanceiroErp } from './financeiro.js'
import { ReproducaoErp } from './reproducao.js'
import { OutrosErp } from './outros.js'
import { ValidationError } from '../errors.js'

export class ErpApi {
  #grid
  #cadastros
  #animais
  #sanitario
  #estoque
  #custos
  #auditoria
  #financeiro
  #reproducao
  #outros

  constructor(client, auth, options) {
    this.#grid = new ErpGrid(client, auth, options)
    this.#cadastros = new CadastrosErp(this.#grid)
    this.#animais = new AnimaisErp(this.#grid, client)
    this.#sanitario = new SanitarioErp(this.#grid)
    this.#estoque = new EstoqueErp(this.#grid, client, auth)
    this.#custos = new CustosErp(client, auth)
    this.#auditoria = new AuditoriaErp(this.#grid, client)
    this.#financeiro = new FinanceiroErp(this.#grid)
    this.#reproducao = new ReproducaoErp(this.#grid)
    this.#outros = new OutrosErp(this.#grid)
  }

  get cadastros() {
    return this.#cadastros
  }
  get animais() {
    return this.#animais
  }
  get sanitario() {
    return this.#sanitario
  }
  get estoque() {
    return this.#estoque
  }
  get custos() {
    return this.#custos
  }
  get auditoria() {
    return this.#auditoria
  }
  get financeiro() {
    return this.#financeiro
  }
  get reproducao() {
    return this.#reproducao
  }
  get outros() {
    return this.#outros
  }

  // Acesso genérico a qualquer grid pelo slug (ex.: um endpoint sem método
  // dedicado), com o mesmo parse BR, fila de fazenda, registro (filtro de
  // data, escopo, prazo) e guardas dos métodos dedicados. Opções: as de
  // fetchPage (page, from, to, extraParams, allowEmpty, propertyId, timeoutMs,
  // signal, dateParam) e, em pages/collect, startPage, maxPages e delayMs.
  fetchPage(slug, options) {
    return this.#grid.fetchPage(checkSlug(slug), options)
  }
  pages(slug, options) {
    return this.#grid.pages(checkSlug(slug), options)
  }
  collect(slug, options) {
    return this.#grid.collect(checkSlug(slug), options)
  }
}

// slug é o nome do recurso, sem barras nem query string (ex.: 'tratos').
function checkSlug(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9_-]+$/.test(slug)) {
    throw new ValidationError('slug deve ser o nome do recurso, sem barras (ex.: "tratos")', {
      field: 'slug',
      received: slug,
    })
  }
  return slug
}
