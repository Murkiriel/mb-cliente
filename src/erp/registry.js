import { ERP_SLUGS } from '../constants.js'

// Registro do que se sabe de cada grid do ERP — a fonte única para validação
// (filtro de data), escopo de fazenda (propertyId) e prazo sugerido. Endpoint
// fora do registro tem escopo 'unknown' e filtro de data não testado.
//
// scope:
//   'property' — respeita a fazenda selecionada na sessão
//   'contract' — devolve a conta inteira, qualquer que seja a fazenda
//   'global'   — ignora a seleção (mesma resposta), às vezes até de outros contratos
//   'leaks'    — deveria ser por fazenda, mas devolve outras fazendas misturadas
//   'unknown'  — sem evidência
// dateParam: nome do filtro de data que o servidor aplica (from/to viram
//   `${dateParam}_0/_1`); null = o servidor ignora o filtro; ausente = não
//   testado (usa 'data').
// timeoutMs: prazo sugerido para endpoints lentos (quem chama pode trocar).
//
// A evidência de cada grupo está em docs/api.md, "Escopo e filtro de cada endpoint".
export const SCOPES = Object.freeze(['property', 'contract', 'global', 'leaks', 'unknown'])

const S = ERP_SLUGS

// Por fazenda: teste direto (contagem muda com a fazenda; busca por id de
// outra fazenda responde 404) ou contagens distintas por fazenda. A sonda de
// 2026-10-29 (contagem sem fazenda × com fazenda) confirmou o segundo bloco.
const PROPERTY = [
  S.LOCALIZACAO,
  S.PROGRAMA_NUTRICIONAL,
  S.CONFINAMENTO,
  S.MOV_MATERIAL,
  S.SAIDA,
  S.MORTE,
  S.GTA,
  S.RECEPCAO_ANIMAIS,
  S.INVENTARIO_ANIMAIS,
  S.TRATOS,
  S.TRATOS_ITEM,
  S.VACINACAO,
  S.TRATAMENTO_ANIMAL,
  S.ENTRADA_MATERIAL,
  S.ENTRADA_MATERIAL_ITEM,
  S.APLICACAO_CONSUMO_LOTE_ANIMAL,
  S.APLICACAO_CONSUMO_LOTE_ANIMAL_ITEM,
  S.DEFINICAO_DIARIA_TRATOS,
  S.HISTORICO_MOVIMENTACAO_LOCALIDADES,
  S.HISTORICO_MOVIMENTACAO_CONFINAMENTO,
  S.CURRAIS,
  S.PRODUCAO_DIETA,
  S.VENDA,
  // Sonda ampla de 2026-10-29 (contagens diferentes entre duas fazendas, ou o
  // campo propriedade dos registros acompanhando a fazenda selecionada).
  S.SOBRA_COCHO,
  S.EXAME,
  S.TRANSFERENCIA_LOTE_ALIMENTAR,
  S.TRANSFERENCIA_LOTE_FINALIDADE,
  S.ANIMAL_REIDENTIFICADO_SISBOV,
  S.ANIMAL_DESMAMADO,
  S.MACHO,
  S.ALTERACAO_PERCENTUAL_MATERIA_SECA,
  S.ENTRADA_SAIDA_MATERIAL,
  S.APLICACAO_CONSUMO,
  S.SAIDA_TRANSFERENCIA_PROPRIEDADES,
  S.SAIDA_VENDA_PERDA,
  S.OUTRAS_SAIDAS,
]

// Conta inteira: a mesma resposta com e sem fazenda selecionada. Os oito
// primeiros foram afirmados um a um; transferências, tratos diários previstos
// e os cadastros contato, materiais, lotealimentar, racao, entidade e
// propriedade foram confirmados pela sonda de 2026-10-29; os demais seguem a
// regra geral "cadastros são por contrato".
const CONTRACT = [
  S.TRANSFERENCIA_PROPRIEDADE,
  S.TRATOS_DIARIOS_PREVISTOS,
  S.CONTA,
  S.FORMA_PAGAMENTO,
  S.RACA,
  S.PELAGEM,
  S.CATEGORIA,
  S.CONTATO_MAO_DE_OBRA,
  S.CONFIGURACOES_LEITURA_COCHO,
  S.CONFIGURACOES_GERAIS,
  S.CONTATO,
  S.GRUPO_MATERIAL,
  S.SUBGRUPO_MATERIAL,
  S.UNIDADES_MEDIDAS,
  S.MATERIAIS,
  S.RACAO,
  S.GRUPO_CONTA,
  S.LOTE_ALIMENTAR,
  S.LOTE_FINALIDADE,
  S.PROPRIEDADE,
  S.REBANHO,
  S.PAIS,
  S.ENTIDADE,
  S.GRUPO_CURRAL,
  S.CATEGORIA_GTA,
  S.SEQUENCIAS_MICROREGIOES,
  S.CONFIGURACOES_LAYOUT,
  S.DISPOSITIVO_MOVEL,
  S.CULTURA,
  S.OPERACAO,
  S.GRAU_DE_SANGUE,
  S.AVALIACAO_MORFOLOGICA,
  S.CORPO_LUTEO,
  S.DETALHE_SITUACAO_FEMEA,
  S.CONFIGURACAO_CATEGORIA,
  S.CONFIGURACAO_CATEGORIA_GTA,
  S.CONFIGURACAO_PLANILHA_GENETICA,
  S.LOTE_DE_AVALIACAO,
  S.TIPO_PASTAGEM,
  S.DIAS_IMPRODUTIVOS,
  S.TECNICA_CONGELACAO,
  S.PREPARACAO_SEMEN_CONFIG,
  S.ESTABELECIMENTO_RURAL_EXTERNO,
  S.ESTABELECIMENTO_RURAL_INTERNO_EXTERNO,
  S.PROPRIETARIO,
  S.PROPRIETARIO_CONTATO,
  S.SETOR,
  S.COFINS_ST,
  S.ICMS_ORIGEM,
  S.ICMS_ST,
  S.PIS_SITUACAO_TRIBUTARIA,
  S.NATUREZA_OPERACOES,
  S.CONDICOES_VENDA,
  S.CATEGORIA_DE_CONTATO,
  S.TIPO_DE_CATEGORIA_DE_CONTATO,
  S.CENTRO_DE_CUSTO,
  S.CONTA_RATEIO,
  S.SITUACAO_MOVIMENTACAO_MATERIAL,
  S.TIPO_VENDA_DESCARTE_DEVOLUCAO,
  S.UNIDADE_COTACAO,
  S.TIPOS_ADV,
  // Sonda ampla de 2026-10-29: a mesma contagem sem fazenda e com duas
  // fazendas diferentes.
  S.MOVIMENTACAO_MATERIAL_ITEM,
  S.USUARIO,
  S.ANIMAL_ALTERACAO_SISBOV,
  S.MOTIVO_DESCARTE_REPRODUTOR,
  S.TIPO_MORTE,
  S.DOENCA,
  S.DOENCA_TRATAMENTO,
  S.SUBGRUPO_MATERIAL_TRATAMENTOS,
  S.SUBGRUPO_MATERIAL_ZOOSSANITARIO,
  S.TIPO_PROTOCOLO,
  S.TRATAMENTO_HORMONIOS,
  S.PREMISTURA,
  S.PRODUTO_SERVICOS,
  S.ATIVOS,
  S.MAQUINARIOS_CONFINAMENTO,
  S.TIPOS_ATIVOS,
  S.HISTORICO_ACOES_APP,
  S.HISTORICO_MOVIMENTACAO_LOTE_DE_AVALIACAO,
  S.CONTROLE_SINCRONIZACAO_CURRAL,
  S.CONTROLE_SINCRONIZACAO_MBTRATOS,
  S.CURRAL_ERROS_EXECUCAO_EVENTO,
  S.ESTATISTICAS_ROTINA_ESTOQUE_ANIMAL_DETALHE,
]

// Ignoram a seleção: catálogos nacionais, auditoria (mistura contratos) e o
// histórico de programa nutricional (mesma contagem em todas as fazendas).
const GLOBAL = [
  S.CIDADE,
  S.ESTADO,
  S.AUDITORIA,
  S.REGRA_DE_REPLICACAO,
  S.HISTORICO_MOVIMENTACAO_PROGRAMA_NUTRICIONAL,
]

// Pesagens: com uma fazenda selecionada vêm animais de outras fazendas da conta.
const LEAKS = [S.MEDICOES_PESAGEM]

// Filtro 'data' confirmado: a janela reduz o resultado.
const DATE_WORKS = [
  S.MORTE,
  S.HISTORICO_MOVIMENTACAO_LOCALIDADES,
  S.AUDITORIA,
  S.APLICACAO_CONSUMO_LOTE_ANIMAL,
  S.APLICACAO_CONSUMO_LOTE_ANIMAL_ITEM,
  S.DEFINICAO_DIARIA_TRATOS,
  S.TRANSFERENCIA_PROPRIEDADE,
  S.HISTORICO_MOVIMENTACAO_PROGRAMA_NUTRICIONAL,
  S.ENTRADA_MATERIAL,
  S.SOBRA_COCHO,
  S.TRATOS,
  S.VACINACAO,
  S.TRATAMENTO_ANIMAL,
  // Sonda ampla de 2026-10-29: uma janela recente e uma de 2020 contam menos
  // que o total.
  S.TRANSFERENCIA_LOTE_ALIMENTAR,
  S.TRANSFERENCIA_LOTE_FINALIDADE,
  S.APLICACAO_CONSUMO,
  S.SAIDA_TRANSFERENCIA_PROPRIEDADES,
  S.SAIDA_VENDA_PERDA,
  S.HISTORICO_ACOES_APP,
  S.HISTORICO_MOVIMENTACAO_LOTE_DE_AVALIACAO,
  S.CONTROLE_SINCRONIZACAO_CURRAL,
  S.CONTROLE_SINCRONIZACAO_MBTRATOS,
]

// Filtro de data que o servidor aplica de verdade, quando o nome não é 'data'.
const DATE_PARAM = {
  [S.TRATOS_ITEM]: 'movimentacao_material__data',
  [S.APLICACAO_CONSUMO_LOTE_ANIMAL_INTERCORRENCIA]: 'periodo',
  // Sonda de 2026-10-29: 'data' é ignorado; data_abertura filtra.
  [S.CONFINAMENTO]: 'data_abertura',
}

// O servidor ignora from/to: aceitar calado faria quem chama acreditar que
// recebeu só a janela pedida.
const DATE_IGNORED = [
  S.SAIDA,
  S.GTA,
  S.HISTORICO_MOVIMENTACAO_CONFINAMENTO,
  S.MEDICOES_PESAGEM,
  S.MOVIMENTACAO_MATERIAL_ITEM,
  S.INVENTARIO_ANIMAIS,
  S.RECEPCAO_ANIMAIS,
  S.PRODUCAO_DIETA,
  S.TRATOS_DIARIOS_PREVISTOS,
  // Sonda ampla de 2026-10-29: a janela recente e a de 2020 devolvem o total.
  S.USUARIO,
  S.ANIMAL_ALTERACAO_SISBOV,
  S.ANIMAL_REIDENTIFICADO_SISBOV,
  S.ANIMAL_DESMAMADO,
  S.MACHO,
  S.MOTIVO_DESCARTE_REPRODUTOR,
  S.TIPO_MORTE,
  S.DOENCA,
  S.DOENCA_TRATAMENTO,
  S.SUBGRUPO_MATERIAL_TRATAMENTOS,
  S.SUBGRUPO_MATERIAL_ZOOSSANITARIO,
  S.TIPO_PROTOCOLO,
  S.TRATAMENTO_HORMONIOS,
  S.PREMISTURA,
  S.PRODUTO_SERVICOS,
  S.ALTERACAO_PERCENTUAL_MATERIA_SECA,
  S.ENTRADA_SAIDA_MATERIAL,
  S.ATIVOS,
  S.MAQUINARIOS_CONFINAMENTO,
  S.TIPOS_ATIVOS,
  S.CURRAL_ERROS_EXECUCAO_EVENTO,
  S.ESTATISTICAS_ROTINA_ESTOQUE_ANIMAL_DETALHE,
]

// Lentos: o cálculo no servidor leva minutos por página.
const TIMEOUT_MS = {
  [S.SOBRA_COCHO]: 300_000,
}

// Campo de cada registro que diz a fazenda dele (documentado no retorno do
// endpoint). Num grid por fazenda, o grid confere esse campo com a fazenda
// selecionada (verifyRecordProperty): é o único jeito de perceber que outra
// sessão da mesma conta trocou a fazenda no servidor. Nos outros escopos o
// campo variar é normal, e ele não é conferido.
// Os grids por fazenda abaixo trazem `propriedade` igual à fazenda selecionada
// em todos os registros vistos pela sonda ampla de 2026-10-29, com duas fazendas.
const RECORD_PROPERTY_FIELD = Object.fromEntries(
  [
    S.GRUPO_CURRAL,
    S.SETOR,
    S.CONTA_RATEIO,
    S.VENDA,
    S.MORTE,
    S.TRATAMENTO_ANIMAL,
    S.VACINACAO,
    S.GTA,
    S.ENTRADA_MATERIAL,
    S.TRATOS,
    S.APLICACAO_CONSUMO_LOTE_ANIMAL,
    S.CONFINAMENTO,
    S.LOCALIZACAO,
    S.PROGRAMA_NUTRICIONAL,
    S.INVENTARIO_ANIMAIS,
    S.RECEPCAO_ANIMAIS,
    S.SOBRA_COCHO,
    S.EXAME,
    S.ANIMAL_REIDENTIFICADO_SISBOV,
    S.ANIMAL_DESMAMADO,
    S.MACHO,
    S.ALTERACAO_PERCENTUAL_MATERIA_SECA,
    S.APLICACAO_CONSUMO,
    S.SAIDA_TRANSFERENCIA_PROPRIEDADES,
    S.SAIDA_VENDA_PERDA,
    S.OUTRAS_SAIDAS,
  ].map((slug) => [slug, 'propriedade'])
)

const REGISTRY = new Map()
const put = (slugs, info) => {
  for (const slug of slugs) REGISTRY.set(slug, { ...REGISTRY.get(slug), ...info })
}
put(PROPERTY, { scope: 'property' })
put(CONTRACT, { scope: 'contract' })
put(GLOBAL, { scope: 'global' })
put(LEAKS, { scope: 'leaks' })
put(DATE_WORKS, { dateParam: 'data' })
for (const [slug, dateParam] of Object.entries(DATE_PARAM)) put([slug], { dateParam })
put(DATE_IGNORED, { dateParam: null })
for (const [slug, timeoutMs] of Object.entries(TIMEOUT_MS)) put([slug], { timeoutMs })
for (const [slug, field] of Object.entries(RECORD_PROPERTY_FIELD)) {
  put([slug], { recordPropertyField: field })
}

// O que se sabe do slug, com os padrões preenchidos.
export function endpointInfo(slug) {
  const info = REGISTRY.get(slug) ?? {}
  return {
    slug,
    scope: info.scope ?? 'unknown',
    dateParam: info.dateParam === undefined ? 'data' : info.dateParam,
    dateTested: info.dateParam !== undefined,
    timeoutMs: info.timeoutMs,
    recordPropertyField: info.recordPropertyField ?? null,
  }
}

// Lista ordenada de todos os slugs registrados (para a documentação e os testes).
export function registeredSlugs() {
  return [...REGISTRY.keys()].sort()
}
