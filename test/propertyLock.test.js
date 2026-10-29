import { describe, it, expect, vi } from 'vitest'
import { PropertyLock } from '../src/propertyLock.js'
import { Auth } from '../src/auth.js'
import { MultBovinos } from '../index.js'
import { BiApi } from '../src/bi/index.js'
import { CustosErp } from '../src/erp/custos.js'
import { forAllProperties } from '../src/helpers/allProperties.js'
import { PropertyNotSelectedError, ValidationError } from '../src/errors.js'

const tick = () => new Promise((r) => setTimeout(r, 1))

describe('PropertyLock', () => {
  it('roda uma seção de cada vez, na ordem de chegada', async () => {
    const lock = new PropertyLock()
    const log = []
    const section = (name) => async () => {
      log.push(`${name}:início`)
      await tick()
      log.push(`${name}:fim`)
      return name
    }
    const r = await Promise.all([lock.exclusive(section('a')), lock.exclusive(section('b'))])
    expect(r).toEqual(['a', 'b'])
    expect(log).toEqual(['a:início', 'a:fim', 'b:início', 'b:fim'])
  })

  it('uma seção que falha não trava a fila', async () => {
    const lock = new PropertyLock()
    const falha = lock.exclusive(async () => {
      throw new Error('boom')
    })
    const after = lock.exclusive(async () => 'ok')
    await expect(falha).rejects.toThrow('boom')
    await expect(after).resolves.toBe('ok')
  })

  it('throw síncrono vira rejeição, dentro e fora da seção', async () => {
    const lock = new PropertyLock()
    const syncFn = () => {
      throw new Error('sync')
    }
    await expect(lock.exclusive(syncFn)).rejects.toThrow('sync')
    await expect(lock.exclusive(() => lock.exclusive(syncFn))).rejects.toThrow('sync')
  })

  it('é reentrante: uma seção aninhada roda direto, sem esperar por si mesma', async () => {
    const lock = new PropertyLock()
    const r = await lock.exclusive(async () => {
      await tick()
      return lock.exclusive(async () => 'aninhada')
    })
    expect(r).toBe('aninhada')
  })

  it('a reentrância não vaza para quem está fora da seção', async () => {
    const lock = new PropertyLock()
    const log = []
    const first = lock.exclusive(async () => {
      log.push('1:início')
      await tick()
      log.push('1:fim')
    })
    // chamada de fora, iniciada enquanto a primeira ainda roda: entra na fila
    const second = lock.exclusive(async () => log.push('2'))
    await Promise.all([first, second])
    expect(log).toEqual(['1:início', '1:fim', '2'])
  })
})

// Auth REAL com um cliente falso que registra a ordem das chamadas e a
// fazenda selecionada no momento de cada leitura.
function setup() {
  const auth = new Auth('u@test.com', 'pass', {
    token: 'tok',
    properties: [
      { id: 1, nome: 'A' },
      { id: 2, nome: 'B' },
      { id: 3, nome: 'C' },
    ],
  })
  const log = []
  const client = {
    postRaw: vi.fn(async (path) => {
      await tick()
      log.push(`select:${path.match(/usuario\/(\d+)/)[1]}`)
      return {}
    }),
    get: vi.fn(async () => {
      await tick()
      log.push(`get:${auth.getSelectedPropertyId()}`)
      return { dados: [{ fazenda: auth.getSelectedPropertyId() }] }
    }),
    post: vi.fn(async (_path, body) => {
      await tick()
      log.push(`post:${body.propriedade}`)
      return { dados: [body.propriedade] }
    }),
  }
  return { auth, client, log }
}

describe('Auth: seção exclusiva por fazenda (Auth real)', () => {
  it('inProperty sem propertyId e sem fazenda selecionada lança PropertyNotSelectedError', async () => {
    const { auth, client } = setup()
    const fn = vi.fn(async () => 'x')
    const err = await auth.inProperty(client, undefined, 'bi.animais.get', fn).catch((e) => e)
    expect(err).toBeInstanceOf(PropertyNotSelectedError)
    expect(err.endpoint).toBe('bi.animais.get')
    expect(err.message).toMatch(/selectProperty\(\) antes ou passe \{ propertyId \}/)
    expect(fn).not.toHaveBeenCalled()
  })

  it('inProperty: com propertyId seleciona e chama; sem, usa a seleção atual sem trocar', async () => {
    const { auth, client, log } = setup()
    await expect(
      auth.inProperty(client, 2, 'bi.x.get', async () => auth.getSelectedPropertyId())
    ).resolves.toBe(2)
    await expect(
      auth.inProperty(client, undefined, 'bi.x.get', async () => auth.getSelectedPropertyId())
    ).resolves.toBe(2)
    expect(log).toEqual(['select:2'])
  })

  it('inProperty com requireSelection: false roda sem fazenda selecionada', async () => {
    const { auth, client, log } = setup()
    await expect(
      auth.inProperty(client, null, 'erp.custos', async () => 'contrato', {
        requireSelection: false,
      })
    ).resolves.toBe('contrato')
    const custos = new CustosErp(client, auth)
    await expect(custos.getSaldoBiologico({ referenceDate: '2026-06-01' })).resolves.toEqual([
      undefined,
    ])
    expect(log).toEqual(['post:undefined'])
  })

  it('leituras sem propertyId rodam juntas (compartilhadas), mas esperam a troca da fila', async () => {
    const { auth, client } = setup()
    await auth.withProperty(client, 1, async () => {})
    const log = []
    const read = (n) => async () => {
      log.push(`${n}:início`)
      await tick()
      log.push(`${n}:fim`)
    }
    await Promise.all([
      auth.inProperty(client, undefined, 'bi.a.get', read('a')),
      auth.inProperty(client, null, 'bi.b.get', read('b')),
      auth.withProperty(client, 2, async () => log.push('troca')),
      auth.inProperty(client, undefined, 'bi.c.get', read('c')),
    ])
    expect(log).toEqual(['a:início', 'b:início', 'a:fim', 'b:fim', 'troca', 'c:início', 'c:fim'])
  })

  it('custos de duas fazendas em paralelo não se misturam', async () => {
    const { auth, client, log } = setup()
    const custos = new CustosErp(client, auth)
    const [a, b] = await Promise.all([
      custos.getCustosAtivos({ propertyId: 1, referenceDate: '2026-06-30' }),
      custos.getCustosAtivos({ propertyId: 2, referenceDate: '2026-06-30' }),
    ])
    expect(a).toEqual([1])
    expect(b).toEqual([2])
    expect(log).toEqual(['select:1', 'post:1', 'select:2', 'post:2'])
    expect(auth.getSelectedPropertyId()).toBe(2)
  })

  it('custo sem propertyId espera a troca de fazenda em andamento', async () => {
    const { auth, client, log } = setup()
    const custos = new CustosErp(client, auth)
    await Promise.all([
      custos.getCustosAtivos({ propertyId: 1, referenceDate: '2026-06-30' }),
      custos.getSaldoBiologico({ referenceDate: '2026-06-01' }),
    ])
    expect(log).toEqual(['select:1', 'post:1', 'post:undefined'])
  })

  it('getAll e uma leitura avulsa: cada leitura vê a fazenda que pediu', async () => {
    const { auth, client, log } = setup()
    const bi = new BiApi(client, auth)
    const [all, standalone] = await Promise.all([
      bi.animais.getAll([1, 2]),
      bi.movEstoque.get({ propertyId: 3 }),
    ])
    expect(all.items.map((i) => [i.fazenda, i._propertyId])).toEqual([
      [1, 1],
      [2, 2],
    ])
    expect(standalone.items).toEqual([{ fazenda: 3 }])
    expect(log).toEqual(['select:1', 'get:1', 'select:3', 'get:3', 'select:2', 'get:2'])
  })

  it('get() sem propertyId lança se nada foi selecionado, e usa a seleção se foi', async () => {
    const { auth, client } = setup()
    const bi = new BiApi(client, auth)
    await expect(bi.suplementacao.get({ from: '2026-10-01', to: '2026-10-28' })).rejects.toThrow(
      PropertyNotSelectedError
    )
    await auth.withProperty(client, 2, async () => {})
    const r = await bi.suplementacao.get({ from: '2026-10-01', to: '2026-10-28' })
    expect(r.items).toEqual([{ fazenda: 2 }])
  })

  it('forAllProperties com chamada por fazenda DENTRO do callback não trava', async () => {
    const { auth, client, log } = setup()
    const bi = new BiApi(client, auth)
    const items = await forAllProperties(
      auth,
      client,
      async () => (await bi.movEstoque.get()).items,
      [1, 2]
    )
    expect(items).toEqual([
      { fazenda: 1, _propertyId: 1 },
      { fazenda: 2, _propertyId: 2 },
    ])
    expect(log).toEqual(['select:1', 'get:1', 'select:2', 'get:2'])
  })
})

describe('PropertyLock: leituras compartilhadas × trocas exclusivas', () => {
  it('leituras rodam juntas; a troca espera as leituras em voo terminarem', async () => {
    const lock = new PropertyLock()
    const log = []
    const read = (n) => async () => {
      log.push(`${n}:início`)
      await tick()
      log.push(`${n}:fim`)
    }
    await Promise.all([
      lock.shared(read('l1')),
      lock.shared(read('l2')),
      lock.exclusive(async () => log.push('troca')),
    ])
    expect(log.slice(0, 2)).toEqual(['l1:início', 'l2:início'])
    expect(log.at(-1)).toBe('troca')
  })

  it('uma leitura não ultrapassa uma troca que já está esperando', async () => {
    const lock = new PropertyLock()
    const log = []
    const l1 = lock.shared(async () => {
      await tick()
      log.push('l1')
    })
    const swap = lock.exclusive(async () => log.push('troca'))
    const l2 = lock.shared(async () => log.push('l2'))
    await Promise.all([l1, swap, l2])
    expect(log).toEqual(['l1', 'troca', 'l2'])
  })

  it('leitura dentro de leitura roda direto; troca dentro de leitura falha em vez de travar', async () => {
    const lock = new PropertyLock()
    await expect(lock.shared(() => lock.shared(async () => 'ok'))).resolves.toBe('ok')
    await expect(lock.shared(() => lock.exclusive(async () => 'x'))).rejects.toThrow(/travaria/)
  })

  it('a marca de "dentro da seção" termina com a seção (promise disparada lá dentro não fura a fila)', async () => {
    const lock = new PropertyLock()
    const log = []
    let fired
    await lock.exclusive(async () => {
      fired = (async () => {
        await new Promise((r) => setTimeout(r, 5))
        return lock.exclusive(async () => log.push('tardia'))
      })()
    })
    const other = lock.exclusive(async () => {
      log.push('outra:início')
      await new Promise((r) => setTimeout(r, 10))
      log.push('outra:fim')
    })
    await Promise.all([fired, other])
    expect(log).toEqual(['outra:início', 'outra:fim', 'tardia'])
  })

  it('inProperty trata null como "sem fazenda" (não seleciona; exige a seleção atual)', async () => {
    const { auth, client, log } = setup()
    const err = await auth.inProperty(client, null, 'bi.x.get', async () => 'x').catch((e) => e)
    expect(err).toBeInstanceOf(PropertyNotSelectedError)
    expect(client.postRaw).not.toHaveBeenCalled()
    expect(log).toEqual([])
  })
})

describe('Auth: fazenda desejada e contador de trocas', () => {
  it('o relogin reseleciona a fazenda de uma troca que estava em voo (não a antiga)', async () => {
    const { auth, client, log } = setup()
    await auth.withProperty(client, 1, async () => {})
    log.length = 0
    let releaseSelect
    client.postRaw.mockImplementation(async (path) => {
      if (path.endsWith('/login-integracao/')) {
        log.push('login')
        return { token: 'tok2', propriedades: [{ propriedade_id: 1 }, { propriedade_id: 2 }] }
      }
      const id = path.match(/usuario\/(\d+)/)[1]
      if (id === '2' && !log.includes('select:2')) await new Promise((r) => (releaseSelect = r))
      log.push(`select:${id}`)
      return {}
    })
    const swap = auth.withProperty(client, 2, async () => auth.getSelectedPropertyId())
    await vi.waitFor(() => expect(releaseSelect).toBeTypeOf('function'))
    const relogin = auth.relogin(client) // 401 numa leitura fora da fila, no meio da troca
    releaseSelect()
    await Promise.all([swap, relogin])
    expect(log).toEqual(['login', 'select:2', 'select:2'])
    expect(auth.getSelectedPropertyId()).toBe(2)
  })

  it('o contador muda numa troca real e num connect, não na reseleção do relogin', async () => {
    const { auth, client } = setup()
    const g0 = auth.getSelectionGeneration()
    await auth.withProperty(client, 1, async () => {})
    await auth.withProperty(client, 1, async () => {}) // mesma fazenda: não é troca
    const g1 = auth.getSelectionGeneration()
    expect(g1).toBe(g0 + 1)
    client.postRaw.mockImplementation(async (path) =>
      path.endsWith('/login-integracao/')
        ? { token: 'tok2', propriedades: [{ propriedade_id: 1 }] }
        : {}
    )
    await auth.relogin(client)
    expect(auth.getSelectedPropertyId()).toBe(1)
    expect(auth.getSelectionGeneration()).toBe(g1)
    await auth.login(client)
    expect(auth.getSelectionGeneration()).toBe(g1 + 1)
    await auth.login(client) // sem fazenda selecionada: não conta
    expect(auth.getSelectionGeneration()).toBe(g1 + 1)
  })

  it('uma seleção que falha não deixa a fazenda desejada para o relogin', async () => {
    const { auth, client } = setup()
    await auth.withProperty(client, 1, async () => {})
    client.postRaw.mockRejectedValueOnce(new Error('caiu'))
    await expect(auth.withProperty(client, 2, async () => {})).rejects.toThrow('caiu')
    const selects = []
    client.postRaw.mockImplementation(async (path) => {
      if (path.endsWith('/login-integracao/'))
        return { token: 't', propriedades: [{ propriedade_id: 1 }, { propriedade_id: 2 }] }
      selects.push(path)
      return {}
    })
    await auth.relogin(client)
    expect(selects).toEqual(['/usuario/1/selecione-propriedade/?format=json'])
  })
})

describe('Auth: troca de fazenda pedida de dentro de uma seção', () => {
  it('no callback de forAllProperties, outra fazenda é recusada e a seção segue na sua', async () => {
    const { auth, client, log } = setup()
    const errs = []
    await forAllProperties(
      auth,
      client,
      async (id) => {
        errs.push(await auth.withProperty(client, 3, async () => 'nunca').catch((e) => e))
        return [{ selected: auth.getSelectedPropertyId(), id }]
      },
      [1]
    )
    expect(errs[0]).toBeInstanceOf(ValidationError)
    expect(errs[0].field).toBe('propertyId')
    expect(errs[0].message).toMatch(/já selecionou a fazenda 1/)
    expect(log).toEqual(['select:1']) // nenhum POST de seleção da fazenda 3
    expect(auth.getSelectedPropertyId()).toBe(1)
  })

  it('a mesma fazenda da seção continua valendo (roda direto)', async () => {
    const { auth, client } = setup()
    const out = await auth.withProperty(client, 2, () =>
      auth.withProperty(client, 2, async () => auth.getSelectedPropertyId())
    )
    expect(out).toBe(2)
  })

  it('dentro de uma leitura compartilhada, a troca é recusada com mensagem clara', async () => {
    const { auth, client } = setup()
    const err = await auth
      .shared(() => auth.withProperty(client, 2, async () => 'nunca'))
      .catch((e) => e)
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.message).toMatch(/dentro de uma leitura/)
  })

  it('fora de qualquer seção (promise que sobreviveu à seção), a troca entra na fila', async () => {
    const { auth, client } = setup()
    let later
    await auth.withProperty(client, 1, async () => {
      later = (async () => {
        await tick()
        await tick()
        return auth.withProperty(client, 2, async () => auth.getSelectedPropertyId())
      })()
    })
    await expect(later).resolves.toBe(2)
  })

  it('mb.selectProperty no callback de forAllProperties também é recusado', async () => {
    const fetch = vi.fn(async () => ({ status: 200, text: async () => '{}' }))
    vi.stubGlobal('fetch', fetch)
    const mb = new MultBovinos({
      email: 'a@b.c',
      password: 'x',
      token: 't',
      properties: [
        { id: 1, nome: 'A' },
        { id: 2, nome: 'B' },
      ],
    })
    const err = await mb
      .forAllProperties(async () => {
        await mb.selectProperty(2)
        return []
      }, [1])
      .catch((e) => e)
    vi.unstubAllGlobals()
    expect(err).toBeInstanceOf(ValidationError)
    expect(fetch.mock.calls.map(([u]) => u).filter((u) => u.includes('/usuario/2/'))).toEqual([])
  })
})
