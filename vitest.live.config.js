import { defineConfig } from 'vitest/config'

// Configuração só do teste de contrato AO VIVO (npm run test:live): o include
// padrão (*.test.js) deixa este arquivo de fora de propósito — assim ele nunca
// roda no `npm test`/coverage/CI —, e por isso precisa de um include próprio.
export default defineConfig({
  test: {
    include: ['test/live-contract.smoke.js'],
  },
})
