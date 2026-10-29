import { FazendasBi } from './fazendas.js'
import { LocalidadesBi } from './localidades.js'
import { FornecedoresBi } from './fornecedores.js'
import { MateriaisBi } from './materiais.js'
import { DietaBi } from './dieta.js'
import { AnimaisBi } from './animais.js'
import { MovEstoqueBi } from './movEstoque.js'
import { MovMateriaisBi } from './movMateriais.js'
import { SuplementacaoBi } from './suplementacao.js'
import { ProducaoRacaoBi } from './producaoRacao.js'

export class BiApi {
  #client
  #auth

  constructor(client, auth) {
    this.#client = client
    this.#auth = auth
  }

  get fazendas() {
    return new FazendasBi(this.#client)
  }
  get localidades() {
    return new LocalidadesBi(this.#client)
  }
  get fornecedores() {
    return new FornecedoresBi(this.#client)
  }
  get materiais() {
    return new MateriaisBi(this.#client)
  }
  get dieta() {
    return new DietaBi(this.#client)
  }
  get animais() {
    return new AnimaisBi(this.#client, this.#auth)
  }
  get movEstoque() {
    return new MovEstoqueBi(this.#client, this.#auth)
  }
  get movMateriais() {
    return new MovMateriaisBi(this.#client, this.#auth)
  }
  get suplementacao() {
    return new SuplementacaoBi(this.#client, this.#auth)
  }
  get producaoRacao() {
    return new ProducaoRacaoBi(this.#client, this.#auth)
  }
}
