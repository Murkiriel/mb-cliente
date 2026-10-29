import { AsyncLocalStorage } from 'node:async_hooks'

// Fila por instância para tudo que depende da fazenda selecionada. A seleção
// é estado do SERVIDOR (por usuário): uma troca de fazenda no meio de uma
// leitura faria a leitura devolver dados da outra fazenda.
//
// Dois modos, ao estilo leitores/escritor:
//   exclusive — troca de fazenda, ou "seleciona e chama" (custos, getAll,
//               forAllProperties, BI por fazenda): roda sozinha.
//   shared    — uma página de grid ERP, ou uma leitura sobre a fazenda já
//               selecionada (Auth.inProperty sem propertyId): várias rodam
//               juntas, mas nunca ao mesmo tempo que uma seção exclusiva.
// A ordem de chegada é respeitada: uma leitura não ultrapassa uma troca que
// já está esperando (senão leituras seguidas poderiam adiar a troca para
// sempre).
//
// Reentrante: dentro de uma seção exclusiva (ex.: o callback de
// forAllProperties chamando bi.suplementacao.get()), qualquer chamada roda
// direto — senão esperaria por si mesma para sempre. Dentro de uma leitura,
// outra leitura também roda direto. A marca de "dentro da seção" é desligada
// quando a seção termina: uma promise disparada lá dentro e que continua
// depois não fura a fila.
export class PropertyLock {
  #queue = []
  #exclusiveActive = false
  #sharedActive = 0
  #als = new AsyncLocalStorage()

  exclusive(fn) {
    return this.#acquire('exclusive', fn)
  }

  shared(fn) {
    return this.#acquire('shared', fn)
  }

  // Seção em que o chamador está agora ('exclusive' ou 'shared'), ou null
  // fora de qualquer seção (inclusive numa promise que sobreviveu à seção).
  currentMode() {
    const ctx = this.#als.getStore()
    return ctx?.active ? ctx.mode : null
  }

  #acquire(mode, fn) {
    const ctx = this.#als.getStore()
    if (ctx?.active && (ctx.mode === 'exclusive' || mode === 'shared')) {
      return (async () => fn())()
    }
    // Uma troca de fazenda pedida de dentro de uma leitura esperaria a própria
    // leitura terminar. Não acontece no SDK (a leitura é só a requisição da
    // página); se algum dia acontecer, falha alto em vez de travar.
    if (ctx?.active) {
      return Promise.reject(
        new Error('PropertyLock: seção exclusiva pedida dentro de uma leitura (travaria)')
      )
    }
    return new Promise((resolve, reject) => {
      this.#queue.push({ mode, fn, resolve, reject })
      this.#pump()
    })
  }

  #pump() {
    while (this.#queue.length > 0 && !this.#exclusiveActive) {
      const next = this.#queue[0]
      if (next.mode === 'exclusive' && this.#sharedActive > 0) return
      this.#queue.shift()
      this.#start(next)
    }
  }

  #start({ mode, fn, resolve, reject }) {
    if (mode === 'exclusive') this.#exclusiveActive = true
    else this.#sharedActive++
    const ctx = { mode, active: true }
    const done = () => {
      ctx.active = false
      if (mode === 'exclusive') this.#exclusiveActive = false
      else this.#sharedActive--
      this.#pump()
    }
    this.#als
      .run(ctx, () => (async () => fn())())
      .then(
        (value) => {
          done()
          resolve(value)
        },
        (err) => {
          done()
          reject(err)
        }
      )
  }
}
