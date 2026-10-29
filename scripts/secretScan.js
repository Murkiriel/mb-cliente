// Detecção de segredo antes de commitar — defesa em profundidade além do
// .gitignore. Dois padrões deliberadamente restritos, para não gerar falso
// positivo contra dados de teste (que usam credencial falsa de propósito):
//   - arquivo .env real sendo commitado (não .env.example)
//   - formatos de credencial real e inconfundíveis (chave AWS, bloco de
//     chave privada PEM) — nunca aparecem por acaso num texto de teste.
const ENV_FILE_RE = /(^|\/)\.env(\.[^./]+)?$/
const ALLOWED_ENV_FILE_RE = /\.env\.example$/

const CONTENT_PATTERNS = [
  { name: 'chave de acesso AWS', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'bloco de chave privada PEM', re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
]

export function isRealEnvFile(path) {
  return ENV_FILE_RE.test(path) && !ALLOWED_ENV_FILE_RE.test(path)
}

export function credentialPatterns(content) {
  return CONTENT_PATTERNS.filter((p) => p.re.test(content)).map((p) => p.name)
}

export function scanStagedFiles(files) {
  const violations = []
  for (const { path, content } of files) {
    if (isRealEnvFile(path)) {
      violations.push(`${path}: arquivo .env real sendo commitado`)
    }
    for (const name of credentialPatterns(content ?? '')) {
      violations.push(`${path}: parece conter ${name}`)
    }
  }
  return violations
}
