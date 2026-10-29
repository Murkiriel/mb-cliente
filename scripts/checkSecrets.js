// Ligação real do hook de pre-commit — chama `git` de verdade, só roda via
// .githooks/pre-commit ou manualmente (`node scripts/checkSecrets.js`),
// nunca em teste. A lógica de detecção (testável, sem tocar em git) vive em
// scripts/secretScan.js.
import { execFileSync } from 'node:child_process'
import { scanStagedFiles } from './secretScan.js'

/* v8 ignore start -- ver comentário acima */
// -z: caminhos crus, separados por NUL. Sem isso o git devolve nomes com
// acento entre aspas e com escapes octais, o `git show :<caminho>` falha e o
// arquivo seria tratado como vazio, sem verificação.
function stagedFiles() {
  const output = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'],
    {
      encoding: 'utf8',
    }
  )
  return output.split('\0').filter(Boolean)
}

function stagedContent(path) {
  try {
    return execFileSync('git', ['show', `:${path}`], { encoding: 'utf8' })
  } catch {
    // binário, arquivo removido entre o diff e o show, etc. — não é o que
    // este verificador procura, então trata como "sem conteúdo" em vez de falhar.
    return ''
  }
}

// test/secretScan.test.js contém, de propósito, strings no formato exato
// dos padrões detectados (chave AWS/PEM falsas) para testar o verificador —
// excluído aqui para não se autodenunciar a cada commit.
const EXCLUDED_FILES = new Set(['test/secretScan.test.js'])

const files = stagedFiles()
  .filter((path) => !EXCLUDED_FILES.has(path))
  .map((path) => ({ path, content: stagedContent(path) }))
const violations = scanStagedFiles(files)

if (violations.length > 0) {
  console.error('\nCommit bloqueado — possível segredo detectado:\n')
  for (const v of violations) console.error(`  ${v}`)
  console.error('\nSe for falso positivo, revise scripts/secretScan.js.\n')
  process.exit(1)
}
/* v8 ignore stop */
