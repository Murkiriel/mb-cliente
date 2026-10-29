import { describe, it, expect } from 'vitest'
import { isRealEnvFile, credentialPatterns, scanStagedFiles } from '../scripts/secretScan.js'

describe('isRealEnvFile', () => {
  it('detecta .env na raiz e em subpasta', () => {
    expect(isRealEnvFile('.env')).toBe(true)
    expect(isRealEnvFile('pacote/.env')).toBe(true)
  })

  it('não acusa .env.example (formato documentado, sem valor real)', () => {
    expect(isRealEnvFile('.env.example')).toBe(false)
  })

  it('não acusa arquivo comum', () => {
    expect(isRealEnvFile('src/client.js')).toBe(false)
    expect(isRealEnvFile('README.md')).toBe(false)
  })
})

describe('credentialPatterns', () => {
  it('detecta chave de acesso AWS', () => {
    expect(credentialPatterns('aws_key = "AKIAABCDEFGHIJKLMNOP"')).toEqual(['chave de acesso AWS'])
  })

  it('detecta bloco de chave privada PEM', () => {
    expect(credentialPatterns('-----BEGIN RSA PRIVATE KEY-----\nMIIEow...')).toEqual([
      'bloco de chave privada PEM',
    ])
  })

  it('não acusa senha falsa dos dados de teste (evita falso positivo no próprio projeto)', () => {
    expect(credentialPatterns("password: 'x'")).toEqual([])
    expect(credentialPatterns('MB_PASS=segredo-do-arquivo')).toEqual([])
    expect(credentialPatterns("email: 'teste@exemplo.com'")).toEqual([])
  })

  it('conteúdo vazio ou comum não acusa nada', () => {
    expect(credentialPatterns('const x = 1')).toEqual([])
  })
})

describe('scanStagedFiles', () => {
  it('sem arquivos staged: sem violações', () => {
    expect(scanStagedFiles([])).toEqual([])
  })

  it('acusa .env real e chave AWS juntos, cada um no seu próprio arquivo', () => {
    const violations = scanStagedFiles([
      { path: '.env', content: 'MB_EMAIL=real@empresa.com\nMB_PASS=senha-real' },
      { path: 'scripts/aws.js', content: 'const key = "AKIAABCDEFGHIJKLMNOP"' },
      { path: 'src/client.js', content: "password: 'x'" },
    ])
    expect(violations).toHaveLength(2)
    expect(violations[0]).toMatch(/\.env: arquivo \.env real/)
    expect(violations[1]).toMatch(/scripts\/aws\.js: parece conter chave de acesso AWS/)
  })

  it('conteúdo undefined (ex.: git show falhou) não quebra o scanner', () => {
    expect(scanStagedFiles([{ path: 'algo.js', content: undefined }])).toEqual([])
  })
})
