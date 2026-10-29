// Testes de endpoints adicionais (fora do manual oficial) — ver comentários em constants.js e
// nos módulos erp/cadastros.js, erp/estoque.js, erp/animais.js, erp/custos.js,
// erp/financeiro.js, erp/reproducao.js.
import { describe, it, expect, vi } from 'vitest'
import { ErpGrid } from '../src/erp/grid.js'
import { EmptyResponseError } from '../src/errors.js'
import { CadastrosErp } from '../src/erp/cadastros.js'
import { EstoqueErp } from '../src/erp/estoque.js'
import { AnimaisErp } from '../src/erp/animais.js'
import { FinanceiroErp } from '../src/erp/financeiro.js'
import { ReproducaoErp } from '../src/erp/reproducao.js'
import { REPRODUCAO_SLUGS, FINANCEIRO_SLUGS } from '../src/constants.js'

function fakeGridClient() {
  return { get: vi.fn().mockResolvedValue({ count: 1, results: [{ id: 1 }], links: {} }) }
}

describe('CadastrosErp — endpoints adicionais', () => {
  const cases = [
    ['getEntidades', '/entidade/'],
    ['getContatosMaoDeObra', '/contatomaodeobra/'],
    ['getLocalizacoes', '/localizacao/'],
    ['getCurrais', '/currais/'],
    ['getGruposCurral', '/grupocurral/'],
    ['getCategoriasGta', '/categoriagta/'],
    ['getSequenciasMicroregioes', '/sequenciasmicroregioes/'],
    ['getConfiguracoesLayout', '/configuracoeslayout/'],
    ['getDispositivosMoveis', '/dispositivomovel/'],
    ['getCulturas', '/cultura/'],
    ['getOperacoes', '/operacao/'],
  ]
  for (const [method, path] of cases) {
    it(`${method} delega para ${path}`, async () => {
      const client = fakeGridClient()
      const cadastros = new CadastrosErp(new ErpGrid(client))
      await cadastros[method]({ page: 1 })
      expect(client.get).toHaveBeenCalledWith(path, expect.objectContaining({ page: 1 }))
    })
  }
})

describe('EstoqueErp — endpoints adicionais', () => {
  const cases = [
    ['getTransferenciasPropriedade', '/transferenciapropriedade/'],
    ['getTransferenciasLoteAlimentar', '/transferencialotealimentar/'],
    ['getTransferenciasLoteFinalidade', '/transferencialotefinalidade/'],
    ['getProgramasNutricionais', '/programanutricional/'],
    ['getTratosDiariosPrevistos', '/tratosdiariosprevistos/'],
    ['getDefinicaoDiariaTratos', '/definicaodiariatratos/'],
    ['getProducaoDietas', '/producaodieta/'],
  ]
  for (const [method, path] of cases) {
    it(`${method} delega para ${path}`, async () => {
      const client = fakeGridClient()
      const estoque = new EstoqueErp(new ErpGrid(client), { post: vi.fn() })
      await estoque[method]({ page: 1 })
      expect(client.get).toHaveBeenCalledWith(path, expect.objectContaining({ page: 1 }))
    })
  }
})

describe('AnimaisErp — endpoints adicionais', () => {
  it('getInventariosAnimais delega para /inventarioanimais/', async () => {
    const client = fakeGridClient()
    const animais = new AnimaisErp(new ErpGrid(client), { post: vi.fn(), put: vi.fn() })
    await animais.getInventariosAnimais({ page: 1 })
    expect(client.get).toHaveBeenCalledWith(
      '/inventarioanimais/',
      expect.objectContaining({ page: 1 })
    )
  })
})

describe('FinanceiroErp — vazio lança por padrão, allowEmpty é de quem chama', () => {
  const methods = [
    ['getBancos', FINANCEIRO_SLUGS.BANCO],
    ['getOrcamentos', FINANCEIRO_SLUGS.ORCAMENTO],
    ['getMovimentacoesFinanceiras', FINANCEIRO_SLUGS.MOVIMENTACAO_FINANCEIRA],
    ['getMovimentacoesFinanceirasContas', FINANCEIRO_SLUGS.MOVIMENTACAO_FINANCEIRA_CONTA],
    ['getContasFinanceiras', FINANCEIRO_SLUGS.CONTA_FINANCEIRO],
  ]
  for (const [method, slug] of methods) {
    it(`${method}: vazio lança por padrão; com allowEmpty vira resultado vazio`, async () => {
      const client = {
        get: vi
          .fn()
          .mockRejectedValue(new EmptyResponseError('vazio', { possiblyRateLimited: true })),
      }
      const financeiro = new FinanceiroErp(new ErpGrid(client))
      await expect(financeiro[method]()).rejects.toBeInstanceOf(EmptyResponseError)
      const result = await financeiro[method]({ allowEmpty: true })
      expect(result.items).toHaveLength(0)
      expect(result.reason).toBe('possibly_rate_limited')
      expect(client.get).toHaveBeenCalledWith(`/${slug}/`, expect.any(Object))
    })
  }

  it('getCotacoesDiarias NÃO usa allowEmpty (pode ter registros mesmo sem o módulo financeiro)', async () => {
    const client = fakeGridClient()
    const financeiro = new FinanceiroErp(new ErpGrid(client))
    await financeiro.getCotacoesDiarias()
    const params = client.get.mock.calls[0][1]
    expect(params.allowEmpty).toBeUndefined()
  })
})

describe('ReproducaoErp — vazio lança por padrão, allowEmpty é de quem chama', () => {
  const methods = [
    ['getCios', REPRODUCAO_SLUGS.CIO],
    ['getEstacoesMonta', REPRODUCAO_SLUGS.ESTACAO_MONTA],
    ['getEstacoesMontaIa', REPRODUCAO_SLUGS.ESTACAO_MONTA_IA],
    ['getAcasalamentos', REPRODUCAO_SLUGS.ACASALAMENTO],
    ['getResultadosSexagem', REPRODUCAO_SLUGS.RESULTADO_SEXAGEM],
    ['getResultadosDiagnosticoGestacao', REPRODUCAO_SLUGS.RESULTADO_DIAGNOSTICO_GESTACAO],
    ['getAvaliacoesOvarianas', REPRODUCAO_SLUGS.AVALIACAO_OVARIANA],
    ['getAspiracoesOvocitos', REPRODUCAO_SLUGS.ASPIRACAO_OVOCITOS],
    ['getSafrasAnimal', REPRODUCAO_SLUGS.SAFRA_ANIMAL],
    ['getAvaliacoesAtivo', REPRODUCAO_SLUGS.AVALIACAO_ATIVO],
    ['getComprasSemen', REPRODUCAO_SLUGS.COMPRA_SEMEN],
    ['getComprasSemenItens', REPRODUCAO_SLUGS.COMPRA_SEMEN_ITEM],
    ['getVendasSemen', REPRODUCAO_SLUGS.VENDA_SEMEN],
    ['getVendasSemenItens', REPRODUCAO_SLUGS.VENDA_SEMEN_ITEM],
    ['getMovimentacoesSemen', REPRODUCAO_SLUGS.MOVIMENTACAO_SEMEN],
    ['getComprasEmbriao', REPRODUCAO_SLUGS.COMPRA_EMBRIAO],
    ['getVendasEmbriaoGrupo', REPRODUCAO_SLUGS.VENDA_EMBRIAO_GRUPO],
    ['getTransferenciasLoteReprodutivo', REPRODUCAO_SLUGS.TRANSFERENCIA_LOTE_REPRODUTIVO],
    ['getTransferenciasLoteGenetico', REPRODUCAO_SLUGS.TRANSFERENCIA_LOTE_GENETICO],
    ['getComunicacoesAbczOnline', REPRODUCAO_SLUGS.COMUNICACAO_ABCZ_ONLINE],
    ['getProblemas', REPRODUCAO_SLUGS.PROBLEMA],
    ['getAnosAgricolas', REPRODUCAO_SLUGS.ANO_AGRICOLA],
    ['getCiclosProducao', REPRODUCAO_SLUGS.CICLO_PRODUCAO],
    ['getCiclosProducaoLocalidade', REPRODUCAO_SLUGS.CICLO_PRODUCAO_LOCALIDADE],
    ['getCentrosDistribuicao', REPRODUCAO_SLUGS.CENTRO_DISTRIBUICAO],
    ['getSafras', REPRODUCAO_SLUGS.SAFRA],
    ['getAtividadesAgricolas', REPRODUCAO_SLUGS.ATIVIDADE_AGRICOLA],
    ['getClassificacoes', REPRODUCAO_SLUGS.CLASSIFICACAO],
    ['getRegrasTributarias', REPRODUCAO_SLUGS.REGRA_TRIBUTARIA],
    ['getVariedades', REPRODUCAO_SLUGS.VARIEDADE],
  ]
  for (const [method, slug] of methods) {
    it(`${method}: vazio lança por padrão; com allowEmpty vira resultado vazio`, async () => {
      const client = {
        get: vi
          .fn()
          .mockRejectedValue(new EmptyResponseError('vazio', { possiblyRateLimited: true })),
      }
      const reproducao = new ReproducaoErp(new ErpGrid(client))
      await expect(reproducao[method]()).rejects.toBeInstanceOf(EmptyResponseError)
      const result = await reproducao[method]({ allowEmpty: true })
      expect(result.items).toHaveLength(0)
      expect(result.reason).toBe('possibly_rate_limited')
      expect(client.get).toHaveBeenCalledWith(`/${slug}/`, expect.any(Object))
    })
  }
})
