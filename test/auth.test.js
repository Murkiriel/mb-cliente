import { describe, it, expect, vi } from 'vitest'
import { Auth } from '../src/auth.js'
import { AuthError, ClientError, PropertyNotSelectedError, ServerError } from '../src/errors.js'

function makeClient(overrides = {}) {
  return {
    postRaw: vi.fn().mockResolvedValue({
      token: 'tok123',
      propriedades: [
        { propriedade_id: 1, nome: 'Fazenda A', cnpj: '11111111000100' },
        { propriedade_id: 2, nome: 'Fazenda B', cnpj: null },
      ],
    }),
    ...overrides,
  }
}

describe('Auth.login', () => {
  it('armazena token e propriedades (campo propriedades)', async () => {
    const auth = new Auth('u@test.com', 'pass')
    const client = makeClient()
    const result = await auth.login(client)

    expect(result.token).toBe('tok123')
    expect(result.properties).toHaveLength(2)
    expect(result.properties[0]).toEqual({ id: 1, nome: 'Fazenda A', cnpj: '11111111000100' })
    expect(auth.getToken()).toBe('tok123')
  })

  it('lê propriedades do campo fazendas quando propriedades está ausente', async () => {
    const auth = new Auth('u@test.com', 'pass')
    const client = {
      postRaw: vi.fn().mockResolvedValue({
        token: 'tok-fazendas',
        fazendas: [
          { id: 1, nome: 'Fazenda A', cnpj: '' },
          { id: 2, nome: 'Fazenda B', cnpj: '' },
        ],
      }),
    }
    const result = await auth.login(client)
    expect(result.token).toBe('tok-fazendas')
    expect(result.properties).toHaveLength(2)
    expect(result.properties[0]).toEqual({ id: 1, nome: 'Fazenda A', cnpj: '' })
    expect(result.properties[1].id).toBe(2)
  })

  it('propriedades vazio quando nem fazendas nem propriedades vêm na resposta', async () => {
    const auth = new Auth('u@test.com', 'pass')
    const client = { postRaw: vi.fn().mockResolvedValue({ token: 'tok-sem-props' }) }
    const result = await auth.login(client)
    expect(result.properties).toEqual([])
  })

  it.each([
    ['sem campo token', { propriedades: [] }],
    ['token vazio', { token: '', propriedades: [] }],
    ['token não-string', { token: 123, propriedades: [] }],
    ['corpo nulo', null],
  ])('login 200 %s lança AuthError e não autentica', async (_caso, body) => {
    const auth = new Auth('u@test.com', 'pass')
    const client = { postRaw: vi.fn().mockResolvedValue(body) }
    await expect(auth.login(client)).rejects.toThrow(/sem token/)
    expect(auth.getToken()).toBeNull()
    expect(() => auth.getAuthHeader()).toThrow(AuthError)
  })

  it('faz o POST de login anônimo (sem o JWT antigo) e sem relogin', async () => {
    const auth = new Auth('u@test.com', 'pass', { token: 'velho' })
    const client = makeClient()
    await auth.login(client)
    expect(client.postRaw).toHaveBeenCalledWith(
      '/login-integracao/',
      { email: 'u@test.com', password: 'pass' },
      { suppressRelogin: true, anonymous: true }
    )
  })

  it.each([400, 403])('ClientError %i no login vira AuthError com cause', async (statusCode) => {
    const auth = new Auth('u@test.com', 'errada')
    const original = new ClientError('x', { statusCode, body: '{"non_field_errors":["x"]}' })
    const client = { postRaw: vi.fn().mockRejectedValue(original) }
    const err = await auth.login(client).catch((e) => e)
    expect(err).toBeInstanceOf(AuthError)
    expect(err.statusCode).toBe(statusCode)
    expect(err.serverMessage).toBe('{"non_field_errors":["x"]}')
    expect(err.cause).toBe(original)
  })

  it('outros erros do login propagam sem conversão', async () => {
    const auth = new Auth('u@test.com', 'pass')
    const notFound = new ClientError('x', { statusCode: 404, body: '' })
    await expect(auth.login({ postRaw: vi.fn().mockRejectedValue(notFound) })).rejects.toBe(
      notFound
    )
    const server = new ServerError('x', { statusCode: 500, body: '' })
    await expect(auth.login({ postRaw: vi.fn().mockRejectedValue(server) })).rejects.toBe(server)
  })
})

describe('Auth com token pré-existente', () => {
  it('começa autenticado sem chamar login', () => {
    const auth = new Auth('u@test.com', 'pass', { token: 'existing-token' })
    expect(auth.getToken()).toBe('existing-token')
  })

  it('restaura propriedades para uso sem servidor, sem connect()', () => {
    const cachedProperties = [
      { id: 10, nome: 'Fazenda A', cnpj: '11111111000100' },
      { id: 20, nome: 'Fazenda B', cnpj: null },
    ]
    const auth = new Auth('u@test.com', 'pass', { token: 'tok', properties: cachedProperties })
    expect(auth.getProperties()).toHaveLength(2)
    expect(auth.getProperties()[0].id).toBe(10)
    expect(auth.getProperties()[1].nome).toBe('Fazenda B')
  })

  it('restaura propriedades cacheadas no formato propriedade_id (sem campo id)', () => {
    const cachedProperties = [{ propriedade_id: 30, nome: 'Fazenda C', cnpj: null }]
    const auth = new Auth('u@test.com', 'pass', { token: 'tok', properties: cachedProperties })
    expect(auth.getProperties()[0].id).toBe(30)
  })
})

describe('Auth.selectProperty', () => {
  it('seleciona propriedade válida', async () => {
    const auth = new Auth('u@test.com', 'pass')
    const client = makeClient()
    await auth.login(client)

    const selectClient = { postRaw: vi.fn().mockResolvedValue({ dados: true }) }
    await auth.selectProperty(selectClient, 1)
    expect(auth.getSelectedPropertyId()).toBe(1)
  })

  it('lança PropertyNotSelectedError para ID inválido', async () => {
    const auth = new Auth('u@test.com', 'pass')
    const client = makeClient()
    await auth.login(client)

    const selectClient = { postRaw: vi.fn() }
    await expect(auth.selectProperty(selectClient, 999)).rejects.toBeInstanceOf(
      PropertyNotSelectedError
    )
  })
})

describe('Auth.getAuthHeader', () => {
  it('lança AuthError quando chamado antes de qualquer login', () => {
    const auth = new Auth('u@test.com', 'pass')
    expect(() => auth.getAuthHeader()).toThrow(AuthError)
  })

  it('retorna "JWT <token>" quando autenticado', async () => {
    const auth = new Auth('u@test.com', 'pass')
    await auth.login(makeClient())
    expect(auth.getAuthHeader()).toBe('JWT tok123')
  })
})

describe('Auth.relogin deduplicação', () => {
  it('dois 401 simultâneos disparam apenas um relogin', async () => {
    const auth = new Auth('u@test.com', 'pass')
    let loginCount = 0
    const client = {
      postRaw: vi.fn().mockImplementation(async () => {
        loginCount++
        await new Promise((r) => setTimeout(r, 10))
        return { token: `tok${loginCount}`, propriedades: [] }
      }),
    }

    // login inicial, para já haver um token
    await auth.login(client)
    loginCount = 0

    const [r1, r2] = await Promise.all([auth.relogin(client), auth.relogin(client)])
    expect(loginCount).toBe(1) // apenas um login efetivo
    expect(r1).toBe(r2) // mesma Promise retornada
  })
})

describe('Auth.relogin reseleciona propriedade', () => {
  it('reseleciona a propriedade que estava ativa antes do 401', async () => {
    const auth = new Auth('u@test.com', 'pass')
    const calls = []
    const client = {
      postRaw: vi.fn().mockImplementation(async (path) => {
        calls.push(path)
        if (path === '/login-integracao/') {
          return {
            token: 'tok2',
            propriedades: [{ propriedade_id: 5, nome: 'Fazenda X', cnpj: null }],
          }
        }
        return { dados: true }
      }),
    }

    await auth.login(client)
    await auth.selectProperty(client, 5)
    calls.length = 0

    await auth.relogin(client)

    expect(calls).toEqual(['/login-integracao/', '/usuario/5/selecione-propriedade/?format=json'])
    expect(auth.getSelectedPropertyId()).toBe(5)
  })

  it('não tenta reselecionar quando nenhuma propriedade estava selecionada', async () => {
    const auth = new Auth('u@test.com', 'pass')
    const client = makeClient()
    await auth.login(client)
    client.postRaw.mockClear()

    await auth.relogin(client)

    expect(client.postRaw).toHaveBeenCalledTimes(1) // só o login, sem selecione-propriedade
    expect(auth.getSelectedPropertyId()).toBeNull()
  })
})
