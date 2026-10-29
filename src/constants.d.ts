// Constantes da API — exportadas no namespace `constants` da raiz e em `/constants`.

export declare const BASE_URL: { readonly production: string; readonly test: string }
export declare const BI_SLUGS: Readonly<Record<string, string>>
export declare const ERP_SLUGS: Readonly<Record<string, string>>
export declare const CUSTO_PATHS: Readonly<Record<string, string>>
/** Rotas de reprodução/genética/sêmen/embrião — só trazem dados se a conta usa o módulo. */
export declare const REPRODUCAO_SLUGS: Readonly<Record<string, string>>
/** Rotas de financeiro — só trazem dados se a conta usa o módulo financeiro. */
export declare const FINANCEIRO_SLUGS: Readonly<Record<string, string>>
/** Equipamentos de curral, gestão de contratos, agrícola avulso — só trazem dados se a conta usa o módulo. */
export declare const OUTROS_SLUGS: Readonly<Record<string, string>>
export declare const TIPO_SAIDA_MATERIAL: {
  readonly VENDA: 2
  readonly PERDA: 3
  readonly CONSUMO_GERAL: 4
  readonly ORCAMENTO: 5
  readonly USO_PESSOAL_EPI: 8
  readonly NUTRICIONAL_PASTO: 20
  readonly PRODUCAO_RACAO: 22
  readonly PRODUCAO_PRE_MISTURA: 23
  readonly NUTRICIONAL_CONFINAMENTO: 24
  readonly TRATAMENTO_ANIMAIS: 25
  readonly MANUT_MAQUINARIOS: 27
  readonly ATIVO_FIXO: 28
  readonly PROCESSAMENTO: 30
  readonly AJUSTE_INVENTARIO: 31
}
