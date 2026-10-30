import { describe, it, expect } from 'vitest'
import { streamJsonArray, HEAD_LIMIT } from '../src/jsonStream.js'
import { InvalidResponseError } from '../src/errors.js'

const enc = new TextEncoder()

// Corpo em pedaços de `size` bytes (corta no meio de chaves, strings, escapes
// e caracteres de vários bytes).
async function* chunks(text, size = 7) {
  const bytes = enc.encode(text)
  for (let i = 0; i < bytes.length; i += size) yield bytes.slice(i, i + size)
}

async function collect(text, { size, batchSize = 2, field = 'dados' } = {}) {
  const batches = []
  const out = await streamJsonArray(chunks(text, size), {
    field,
    batchSize,
    slug: '/x',
    onBatch: async (items) => batches.push(items),
  })
  return { out, batches }
}

const ITEMS = [
  { id: 1, nome: 'Boi "Pintado"', obs: 'a\\b {x} [y], ç ã é 🐂' },
  { id: 2, nested: { lista: [1, { a: '}' }], vazio: {} }, nulo: null },
  { id: 3, valor: -1.5e3, ok: true },
]

describe('streamJsonArray', () => {
  it.each([1, 2, 3, 7, 64, 100_000])(
    'entrega os mesmos objetos do JSON.parse, em lotes (pedaços de %i bytes)',
    async (size) => {
      const body = JSON.stringify({ antes: { dados: [9] }, dados: ITEMS, depois: [1, 2] }, null, 2)
      const { out, batches } = await collect(body, { size })
      expect(out).toEqual({ found: true, count: 3 })
      expect(batches.map((b) => b.length)).toEqual([2, 1])
      expect(batches.flat()).toEqual(ITEMS)
    }
  )

  it('chave com escape e lista vazia', async () => {
    const { out, batches } = await collect('{"d\\u0061dos": []}', { field: 'dados' })
    expect(out).toEqual({ found: true, count: 0 })
    expect(batches).toEqual([])
  })

  it('lote cheio no fim não gera lote vazio', async () => {
    const { batches } = await collect(JSON.stringify({ dados: [{ a: 1 }, { a: 2 }] }))
    expect(batches).toEqual([[{ a: 1 }, { a: 2 }]])
  })

  it('sem a lista: devolve o começo do corpo para a classificação de sempre', async () => {
    expect((await collect('  {"detail": "Limite"}')).out).toEqual({
      found: false,
      text: '  {"detail": "Limite"}',
    })
    expect((await collect('{}')).out).toEqual({ found: false, text: '{}' })
    // valor do campo que não é lista não é a lista
    expect((await collect('{"dados": null}')).out).toEqual({
      found: false,
      text: '{"dados": null}',
    })
    expect((await collect('<html>erro</html>')).out).toEqual({
      found: false,
      text: '<html>erro</html>',
    })
  })

  it('corpo de outro formato muito grande: guarda só o começo', async () => {
    const big = '<' + 'x'.repeat(HEAD_LIMIT * 2)
    const { out } = await collect(big, { size: 4096 })
    expect(out.found).toBe(false)
    expect(out.text).toHaveLength(HEAD_LIMIT)
  })

  it('lista com elemento que não é objeto é resposta inválida', async () => {
    await expect(collect('{"dados": [{"a":1}, 2]}')).rejects.toThrow(InvalidResponseError)
    await expect(collect('{"dados": [[1]]}')).rejects.toThrow(/não é um objeto/)
  })

  it('corpo cortado no meio é resposta inválida', async () => {
    await expect(collect('{"dados": [{"a":1}, {"b":')).rejects.toThrow(/corpo JSON incompleto/)
    await expect(collect('{"dados": [{"a":1}]')).rejects.toThrow(/corpo JSON incompleto/)
    await expect(collect('{"dados": [{"a":1}], "x": "abc')).rejects.toThrow(/corpo JSON incompleto/)
  })

  it('objeto ou nome de campo malformado é resposta inválida', async () => {
    const err = await collect('{"dados": [{"a" 1}]}').catch((e) => e)
    expect(err).toBeInstanceOf(InvalidResponseError)
    expect(err.message).toMatch(/objeto da lista inválido/)
    expect(err.slug).toBe('/x')
    await expect(collect('{"\\x": 1}')).rejects.toThrow(/nome de campo inválido/)
  })

  it('erro do onBatch interrompe a leitura e sai como foi lançado', async () => {
    const boom = new Error('banco caiu')
    const body = JSON.stringify({ dados: ITEMS })
    await expect(
      streamJsonArray(chunks(body), {
        field: 'dados',
        batchSize: 1,
        onBatch: async () => {
          throw boom
        },
      })
    ).rejects.toBe(boom)
  })
})
