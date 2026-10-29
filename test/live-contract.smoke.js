// Teste de contrato AO VIVO — não roda em `npm test`/`npm run coverage` (nome
// não termina em .test.js, fora do include padrão do vitest) nem em CI.
// Só existe para ser rodado manualmente, com credenciais reais, quando se
// quer confirmar que o formato real da API ainda bate com as suposições do
// SDK — algo que os testes normais, que usam apenas dados de teste, não provam.
// Só faz LEITURAS (login, seleção de fazenda e GETs).
//
// Uso: MB_EMAIL=... MB_PASS=... npm run test:live (usa vitest.live.config.js)
//
// ⚠️ A seleção de fazenda é estado do servidor, por usuário: não rode junto
// de outro processo que use a mesma conta.
//
// Sem credenciais no ambiente, o arquivo inteiro é pulado (describe.skipIf) —
// nunca falha por engano num ambiente sem acesso à API real.
import { describe, it, expect, beforeAll } from 'vitest'
import { MultBovinos } from '../index.js'

const email = process.env.MB_EMAIL
const pass = process.env.MB_PASS
const hasCredentials = Boolean(email && pass)

// Uma string que ainda tem cara de número BR depois do parse indica que o
// formato real mudou e o SDK deixou de reconhecê-lo.
const BR_NOT_CONVERTED = /^-?\d{1,3}(\.\d{3})*,\d+$/

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 86_400_000)
  return d.toISOString().slice(0, 10)
}

describe.skipIf(!hasCredentials)('contrato ao vivo — formato real da API MultBovinos', () => {
  let mb
  let propertyId

  beforeAll(async () => {
    mb = new MultBovinos({ email, password: pass, timeoutMs: 180_000 })
    const { token, properties } = await mb.connect()
    expect(typeof token).toBe('string')
    expect(properties.length).toBeGreaterThan(0)
    propertyId = properties[0].id
    await mb.selectProperty(propertyId)
  }, 200_000)

  it('erp.cadastros.getMateriais(): página com items e nenhum número BR sem converter', async () => {
    const firstPage = await mb.erp.cadastros.getMateriais({ page: 1 })
    expect(Array.isArray(firstPage.items)).toBe(true)
    expect(typeof firstPage.hasMore).toBe('boolean')
    for (const item of firstPage.items) {
      expect(item).toHaveProperty('id')
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'string' && !key.endsWith('_texto') && BR_NOT_CONVERTED.test(value)) {
          throw new Error(`Campo "${key}" ainda em formato BR não convertido`)
        }
      }
    }
  }, 200_000)

  it('erp.estoque.iterTratos(): pagina com for await e marca a página', async () => {
    const pages = []
    for await (const p of mb.erp.estoque.iterTratos({
      from: isoDaysAgo(7),
      to: isoDaysAgo(0),
      maxPages: 2,
      delayMs: 600,
      allowEmpty: true,
    })) {
      pages.push(p)
    }
    expect(pages.length).toBeGreaterThan(0)
    expect(pages[0].page).toBe(1)
    expect(Array.isArray(pages[0].items)).toBe(true)
  }, 400_000)

  it('bi.movMateriais.get(): BI por fazenda com propertyId', async () => {
    const r = await mb.bi.movMateriais.get({
      from: isoDaysAgo(7),
      to: isoDaysAgo(0),
      propertyId: propertyId,
    })
    expect(Array.isArray(r.items)).toBe(true)
    expect(r.count).toBe(r.items.length)
  }, 200_000)
})
