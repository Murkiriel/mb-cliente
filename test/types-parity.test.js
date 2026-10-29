// Trava automaticamente a paridade entre index.d.ts e os métodos reais dos
// módulos erp/*.js — antes disso, a única forma de pegar uma divergência
// (método novo em src/ sem entrada em index.d.ts, ou vice-versa) era uma
// auditoria manual como a que motivou este teste (achou 0 divergências nos
// 9 módulos, mas nada garantia que continuaria assim no próximo método
// adicionado). test/types-smoke.ts (tsc --noEmit) não serve para isso: ele só
// exercita os métodos que alguém lembrou de chamar ali, não todos.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { CadastrosErp } from '../src/erp/cadastros.js'
import { AnimaisErp } from '../src/erp/animais.js'
import { SanitarioErp } from '../src/erp/sanitario.js'
import { EstoqueErp } from '../src/erp/estoque.js'
import { CustosErp } from '../src/erp/custos.js'
import { AuditoriaErp } from '../src/erp/auditoria.js'
import { FinanceiroErp } from '../src/erp/financeiro.js'
import { ReproducaoErp } from '../src/erp/reproducao.js'
import { OutrosErp } from '../src/erp/outros.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const DTS = readFileSync(resolve(__dir, '../index.d.ts'), 'utf8')

// Extrai os nomes de método declarados dentro de `export interface Nome { ... }`
// (ou `export declare class`, só o MultBovinos) contando chaves para achar o
// fechamento certo — vários métodos recebem um objeto literal como parâmetro,
// com chaves próprias no meio. As classes internas (AnimaisBi, CadastrosErp…)
// são `interface` porque o pacote não as exporta como valor: só servem para
// anotar tipos.
function methodsDeclaredFor(className) {
  const marker = [`export declare class ${className} {`, `export interface ${className} {`].find(
    (mk) => DTS.includes(mk)
  )
  if (marker === undefined) throw new Error(`Classe ${className} não encontrada em index.d.ts`)
  const start = DTS.indexOf(marker)

  const bodyStart = start + marker.length
  let depth = 1
  let i = bodyStart
  while (depth > 0) {
    if (DTS[i] === '{') depth++
    else if (DTS[i] === '}') depth--
    i++
  }
  const body = DTS.slice(bodyStart, i - 1)

  const names = new Set()
  // `nome(` ou `nome<T>(` (genérico); o constructor não é método
  const re = /^ {2}(\w+)[<(]/gm
  let m
  while ((m = re.exec(body))) names.add(m[1])
  names.delete('constructor')
  return names
}

function methodsImplementedBy(Klass) {
  return new Set(
    Object.getOwnPropertyNames(Klass.prototype).filter((name) => name !== 'constructor')
  )
}

describe('index.d.ts — paridade de métodos com o código-fonte real', () => {
  const cases = [
    ['CadastrosErp', CadastrosErp],
    ['AnimaisErp', AnimaisErp],
    ['SanitarioErp', SanitarioErp],
    ['EstoqueErp', EstoqueErp],
    ['CustosErp', CustosErp],
    ['AuditoriaErp', AuditoriaErp],
    ['FinanceiroErp', FinanceiroErp],
    ['ReproducaoErp', ReproducaoErp],
    ['OutrosErp', OutrosErp],
  ]

  for (const [name, Klass] of cases) {
    it(`${name}: todo método real está declarado em index.d.ts, e vice-versa`, () => {
      const implemented = methodsImplementedBy(Klass)
      const declared = methodsDeclaredFor(name)

      const missingInDts = [...implemented].filter((m) => !declared.has(m)).sort()
      const extraInDts = [...declared].filter((m) => !implemented.has(m)).sort()

      expect(missingInDts, 'métodos em src/ sem declaração em index.d.ts').toEqual([])
      expect(extraInDts, 'métodos declarados em index.d.ts sem implementação real').toEqual([])
    })
  }
})

// ── Paridade das classes do BI, do mb.raw e do ponto de entrada ────────────
import { FazendasBi } from '../src/bi/fazendas.js'
import { LocalidadesBi } from '../src/bi/localidades.js'
import { FornecedoresBi } from '../src/bi/fornecedores.js'
import { MateriaisBi } from '../src/bi/materiais.js'
import { DietaBi } from '../src/bi/dieta.js'
import { AnimaisBi } from '../src/bi/animais.js'
import { MovEstoqueBi } from '../src/bi/movEstoque.js'
import { MovMateriaisBi } from '../src/bi/movMateriais.js'
import { SuplementacaoBi } from '../src/bi/suplementacao.js'
import { ProducaoRacaoBi } from '../src/bi/producaoRacao.js'
import { RawApi } from '../src/raw.js'
import { MultBovinos } from '../index.js'

// Só métodos: propriedades de leitura (mb.bi, mb.erp, mb.raw) são acessores, não aparecem
// como `nome(` no .d.ts.
function plainMethodsOf(Klass) {
  return new Set(
    Object.getOwnPropertyNames(Klass.prototype).filter(
      (n) =>
        n !== 'constructor' &&
        typeof Object.getOwnPropertyDescriptor(Klass.prototype, n).value === 'function'
    )
  )
}

describe('index.d.ts — paridade do BI, mb.raw e MultBovinos', () => {
  const cases = [
    ['FazendasBi', FazendasBi],
    ['LocalidadesBi', LocalidadesBi],
    ['FornecedoresBi', FornecedoresBi],
    ['MateriaisBi', MateriaisBi],
    ['DietaBi', DietaBi],
    ['AnimaisBi', AnimaisBi],
    ['MovEstoqueBi', MovEstoqueBi],
    ['MovMateriaisBi', MovMateriaisBi],
    ['SuplementacaoBi', SuplementacaoBi],
    ['ProducaoRacaoBi', ProducaoRacaoBi],
    ['RawApi', RawApi],
    ['MultBovinos', MultBovinos],
  ]
  for (const [name, Klass] of cases) {
    it(`${name}: métodos declarados = métodos reais`, () => {
      expect([...methodsDeclaredFor(name)].sort()).toEqual([...plainMethodsOf(Klass)].sort())
    })
  }
})

// ── Paridade dos EXPORTS de cada subpath do package.json ───────────────────
// Antes, o index.d.ts declarava AuthError & cia. na raiz sem o index.js
// exportá-los: `import { AuthError }` passava no tsc e quebrava ao carregar.
const ROOT = resolve(__dir, '..')

// Nomes de VALOR exportados por um .d.ts (interfaces/types não existem em
// tempo de execução), seguindo `export * from` e `export * as ns from`.
function valueExportsOfDts(dtsPath) {
  const src = readFileSync(dtsPath, 'utf8')
  const names = new Set()
  for (const m of src.matchAll(/^export declare (?:class|function|const) (\w+)/gm)) {
    names.add(m[1])
  }
  for (const m of src.matchAll(/^export \* as (\w+) from '(.+)'/gm)) names.add(m[1])
  for (const m of src.matchAll(/^export \* from '(.+)'/gm)) {
    const target = resolve(dirname(dtsPath), m[1].replace(/\.js$/, '.d.ts'))
    for (const n of valueExportsOfDts(target)) names.add(n)
  }
  return names
}

describe('exports do package.json — .d.ts e código em tempo de execução exportam os mesmos nomes', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    it(`${subpath}: tem types (primeiro) e os nomes batem`, async () => {
      expect(Object.keys(target)[0], 'a condição types precisa vir primeiro').toBe('types')
      const runtime = await import(pathToFileURL(resolve(ROOT, target.import)).href)
      const declared = valueExportsOfDts(resolve(ROOT, target.types))
      expect([...declared].sort()).toEqual(Object.keys(runtime).sort())
    })
  }

  it('/helpers não expõe forAllProperties (exige auth/client internos)', async () => {
    const helpers = await import('../src/helpers/index.js')
    expect(helpers).not.toHaveProperty('forAllProperties')
  })
})
