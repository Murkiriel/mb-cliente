export const BASE_URL = {
  production: 'https://www.multbovinos.com/servicos',
  test: 'https://teste.multbovinos.com/servicos',
}

export const BI_SLUGS = {
  FAZENDAS: 'obtenha-cadastros-fazendas',
  LOCALIDADES: 'obtenha-cadastros-localidades',
  FORNECEDORES: 'obtenha-cadastros-fornecedores',
  MATERIAIS: 'obtenha-cadastros-materiais',
  DIETA: 'obtenha-cadastros-dieta',
  ANIMAIS: 'obtenha-cadastros-gados-sisbov',
  MOV_ESTOQUE: 'obtenha-movimentacoes-gados-estoque',
  MOV_EXTRA: 'obtenha-movimentacoes-gados-extra', // ❌ timeout em todas as variações
  PESAGEM: 'obtenha-monitoramento-pesagem', // ❌ timeout em todas as variações
  MOV_MATERIAIS: 'obtenha-movimentacoes-materiais',
  SUPLEMENTACAO: 'obtenha-suplementacao-animal',
  PROD_RACAO: 'obtenha-producao-racao',
  PROD_RACAO_FORMULACAO: 'obtenha-producao-racao-formulacao',
}

export const ERP_SLUGS = {
  CONTATO: 'contato',
  GRUPO_MATERIAL: 'grupomaterial',
  SUBGRUPO_MATERIAL: 'subgrupomaterial',
  UNIDADES_MEDIDAS: 'unidadesmedidas',
  MATERIAIS: 'materiais',
  RACAO: 'racao',
  CONTA: 'conta',
  GRUPO_CONTA: 'grupoconta',
  FORMA_PAGAMENTO: 'formapagamento',
  LOTE_ALIMENTAR: 'lotealimentar',
  LOTE_FINALIDADE: 'lotefinalidade',
  RACA: 'raca',
  PELAGEM: 'pelagem',
  PROPRIEDADE: 'propriedade',
  CATEGORIA: 'categoria',
  REBANHO: 'rebanho',
  CIDADE: 'cidade',
  ESTADO: 'estado',
  PAIS: 'pais',
  ENTRADA: 'entrada',
  SAIDA: 'saida',
  VENDA: 'venda',
  MORTE: 'morte',
  TRATAMENTO_ANIMAL: 'tratamentoanimal',
  VACINACAO: 'vacinacao',
  EXAME: 'exame',
  GTA: 'gta',
  ENTRADA_MATERIAL: 'entradamaterial',
  TRATOS: 'tratos',
  SOBRA_COCHO: 'sobracocho', // ⚠️ cálculo pesado — inviável sem filtro from/to (horas), viável em janelas curtas (minutos)
  MOV_MATERIAL: 'movimentacaomaterial', // listagem ❌ HTTP 500 (bug de serializador); busca por id /{id}/ ✅ (escopado pela propriedade da sessão, retorna itens[] embutido) — ver getMovimentacaoMaterialById()
  VIA_APLICACAO: 'viaaplicacaotratamento', // ❌ HTTP 500 (re-testado: 500 também na busca por id /{id}/ e em toda variação; formulario/ 400)
  // Eventos reprodutivos/vida — rotas existem; vêm vazias se o módulo não é usado
  PROTOCOLO: 'protocolo',
  OCORRENCIA: 'ocorrencia',
  SEMEN: 'semen',
  EMBRIAO: 'embriao',
  COBERTURA: 'cobertura',
  PARTO: 'parto',

  // Endpoints adicionais (fora do manual oficial).
  AUDITORIA: 'auditoria', // trilha de auditoria completa (volume grande) — filtrar por data
  REGRA_DE_REPLICACAO: 'regradereplicacao', // regras/alertas de validação do MBDT (desktop)
  ENTIDADE_REGRA_DE_REPLICACAO: 'entidaderegradereplicacao', // listagem ❌ HTTP 500; busca por id /{id}/ ✅ (catálogo de tipos de entidade, ids sequenciais com buracos → 404) — ver getEntidadeRegraDeReplicacaoById()
  LOG_DE_REPLICACAO: 'logdereplicacao', // resposta vazia na 1ª tentativa — não confirmado se limite de requisições ou legitimamente vazio
  LOG_REPLICACAO_ANIMAIS_NAO_EXCLUIDOS: 'logreplicacaoanimaisnaoexcluidos', // idem

  // Endpoints adicionais — configuração e itens.
  CONFIGURACOES_GERAIS: 'configuracoesgerais', // configuração da conta: parâmetros de GMD, abate, rastreabilidade etc. (1 registro)
  MOVIMENTACAO_MATERIAL_ITEM: 'movimentacaomaterialitem', // listagem sem NENHUM filtro do servidor (filters:[]); busca por id /{id}/ ✅ e caminho incremental via auditoria (identificador) — ver getMovimentacaoMaterialItemById()/getMovimentacaoMaterialItens()
  TRATOS_ITEM: 'tratositem', // itens de tratos — filtro REAL de data é movimentacao_material__data_0/_1 (confirmado; data_0/data_1 é ignorado) — ver getTratosItens()
  HISTORICO_MOVIMENTACAO_CONFINAMENTO: 'historicomovimentacaolocalizacaoconfinamento', // histórico completo de local por animal em confinamento (volume grande)
  HISTORICO_MOVIMENTACAO_LOCALIDADES: 'historicomovimentacaolocalizacaolocalidades', // idem, para pasto/localidades
  APLICACAO_CONSUMO_LOTE_ANIMAL: 'aplicacaoconsumoloteanimal', // consumo de ração aplicado por lote de animal
  USUARIO: 'usuario', // usuários do sistema
  CONFINAMENTO: 'confinamento', // listagem ❌ HTTP 500 (bug de serializador); busca por id /{id}/ ✅ (escopado pela propriedade da sessão) — ver getConfinamentoById()
  // confinamentoanimal e pesagemmedicao: modelos SEM endpoint REST próprio.
  // pesagemmedicao é coberto por MEDICOES_PESAGEM (slug real:
  // medicoespesagem). confinamentoanimal re-testado (confinamentoanimal,
  // animalconfinamento, animaisconfinamento, confinamentosanimais,
  // animalconfinamentos, confinamentoanimalitem — todos 404), mas o DADO
  // por-animal é acessível: vem no array `animais[]` de GET confinamento/{id}/
  // (getConfinamentoById) — não precisa de endpoint próprio.

  // Endpoints adicionais — cadastros e históricos.
  ENTIDADE: 'entidade', // cadastro genérico de pessoas/empresas (contatos, produtores etc.)
  LOCALIZACAO: 'localizacao', // localidades com dados de cocho/GMD (mais rico que bi.localidades)
  CURRAIS: 'currais', // mesmo modelo de LOCALIZACAO, filtrado a currais de confinamento
  GRUPO_CURRAL: 'grupocurral', // agrupamento de currais
  CATEGORIA_GTA: 'categoriagta', // faixas de categoria usadas em GTA
  SEQUENCIAS_MICROREGIOES: 'sequenciasmicroregioes', // sequências de numeração SISBOV
  CONFIGURACOES_LAYOUT: 'configuracoeslayout', // logo/identidade visual da conta (1 registro)
  DISPOSITIVO_MOVEL: 'dispositivomovel', // celulares registrados nos apps MB (MB Tratos etc.)
  CONTATO_MAO_DE_OBRA: 'contatomaodeobra', // subconjunto de ENTIDADE filtrado a mão de obra
  TRANSFERENCIA_PROPRIEDADE: 'transferenciapropriedade', // histórico de transferência de animal entre propriedades
  TRANSFERENCIA_LOTE_ALIMENTAR: 'transferencialotealimentar',
  TRANSFERENCIA_LOTE_FINALIDADE: 'transferencialotefinalidade',
  PROGRAMA_NUTRICIONAL: 'programanutricional',
  TRATOS_DIARIOS_PREVISTOS: 'tratosdiariosprevistos', // previsão diária de trato por curral
  DEFINICAO_DIARIA_TRATOS: 'definicaodiariatratos', // plano de trato por curral/dieta — filtra por data de verdade
  PRODUCAO_DIETA: 'producaodieta', // batidas de produção de dieta (custo, vagão, responsável)
  INVENTARIO_ANIMAIS: 'inventarioanimais', // eventos de contagem/inventário de rebanho

  // Sub-endpoint de relatório (POST, não listagem/grid), fora do manual
  // oficial. Mesma tela e mesmos dados
  // dos PDFs "Gestão Nutricional". Ver erp.estoque.getRelatorioGestaoNutricionalLote.
  RELATORIO_GESTAO_NUTRICIONAL_LOTE: 'producaopasto/relatorio-gestao-nutricional-lote',

  // Endpoints adicionais — catálogos.
  CULTURA: 'cultura', // catálogo de cultivares/variedades agrícolas
  OPERACAO: 'operacao', // forma parecida com um material isolado, uso ainda incerto

  // Endpoints adicionais — demais rotas reais e funcionais.
  //
  // ⭐ MEDICOES_PESAGEM — pesagem real por animal (volume grande por
  // fazenda). Substitui, na prática, a pesagem do BI
  // (❌ timeout permanente) e pesagemmedicao (❌ sem endpoint).
  // ⚠️ CORREÇÃO: selectProperty() NÃO restringe corretamente
  // este endpoint (vazamento entre propriedades do MESMO contrato) — cada
  // registro traz seu próprio campo propriedade/propriedade_texto correto,
  // que deve ser usado para atribuir a propriedade, nunca a sessão. from/to
  // e propriedade= também não filtram. Ver detalhe completo em erp/animais.js.
  MEDICOES_PESAGEM: 'medicoespesagem',

  // Animais — identificação/ciclo de vida
  ANIMAL_ALTERACAO_SISBOV: 'animalalteracaosisbov',
  ANIMAL_REIDENTIFICADO_SISBOV: 'animalreidentificadosisbov',
  ANIMAL_DESMAMADO: 'animaldesmamado',
  MACHO: 'macho', // mesma contagem do cadastro de animais — provável apelido/view, não confirmado
  MBIVF_WEB_MACHO: 'mbivfwebmacho', // idem
  RECEPCAO_ANIMAIS: 'recepcaoanimais',
  MOTIVO_DESCARTE_REPRODUTOR: 'motivodescartereprodutor',
  TIPO_MORTE: 'tipomorte',

  // Sanitário
  DOENCA: 'doenca',
  DOENCA_TRATAMENTO: 'doencatratamento',
  SUBGRUPO_MATERIAL_TRATAMENTOS: 'subgrupomaterialtratamentos',
  SUBGRUPO_MATERIAL_ZOOSSANITARIO: 'subgrupomaterialzoossanitario',
  TIPO_PROTOCOLO: 'tipoprotocolo',
  TRATAMENTO_HORMONIOS: 'tratamentoshormonios',
  TRATAMENTOS_VACINAS_VERMIFUGOS: 'tratamentosvacinasvermifugos',

  // Genética/avaliação/configuração de cadastro
  GRAU_DE_SANGUE: 'graudesangue',
  AVALIACAO_MORFOLOGICA: 'avaliacaomorfologica',
  CORPO_LUTEO: 'corpoluteo',
  DETALHE_SITUACAO_FEMEA: 'detalhesituacaofemea',
  CONFIGURACAO_CATEGORIA: 'configuracaocategoria',
  CONFIGURACAO_CATEGORIA_GTA: 'configuracaocategoriagta',
  CONFIGURACAO_PLANILHA_GENETICA: 'configuracaoplanilhagenetica',
  CONFIGURACOES_LEITURA_COCHO: 'configuracoesleituracocho',
  LOTE_DE_AVALIACAO: 'lotedeavaliacao',
  TIPO_PASTAGEM: 'tipopastagem',
  DIAS_IMPRODUTIVOS: 'diasimprodutivos',
  TECNICA_CONGELACAO: 'tecnicacongelacao',
  PREPARACAO_SEMEN_CONFIG: 'preparacaosemenconfig',

  // Materiais/estoque/produção
  PREMISTURA: 'premistura',
  PRODUTO_SERVICOS: 'produtoservicos',
  ALTERACAO_PERCENTUAL_MATERIA_SECA: 'alteracaopercentualmateriaseca',
  ENTRADA_MATERIAL_ITEM: 'entradamaterialitem',
  ENTRADA_SAIDA_MATERIAL: 'entradasaidamaterial',
  APLICACAO_CONSUMO: 'aplicacaoconsumo',
  APLICACAO_CONSUMO_LOTE_ANIMAL_ITEM: 'aplicacaoconsumoloteanimalitem',
  APLICACAO_CONSUMO_LOTE_ANIMAL_INTERCORRENCIA: 'aplicacaoconsumoloteanimalintercorrencia',
  SAIDA_TRANSFERENCIA_PROPRIEDADES: 'saidatransferenciapropriedades',
  SAIDA_VENDA_PERDA: 'saidavendaperda',
  OUTRAS_SAIDAS: 'outrassaidas',

  // Ativos/maquinário
  ATIVOS: 'ativos',
  MAQUINARIOS_CONFINAMENTO: 'maquinariosconfinamento',
  TIPOS_ATIVOS: 'tiposativos',

  // Histórico/logs de sincronização (desktop MBDT / apps móveis)
  HISTORICO_ACOES_APP: 'historicoacoesapp',
  HISTORICO_MOVIMENTACAO_LOTE_DE_AVALIACAO: 'historicomovimentacaolotedeavaliacao',
  HISTORICO_MOVIMENTACAO_PROGRAMA_NUTRICIONAL: 'historicomovimentacaoprogramanutricional',
  CONTROLE_SINCRONIZACAO_CURRAL: 'controlesincronizacaocurral',
  CONTROLE_SINCRONIZACAO_MBTRATOS: 'controlesincronizacaombtratos',
  CURRAL_ERROS_EXECUCAO_EVENTO: 'curralerrosexecucaoevento',
  ESTATISTICAS_ROTINA_ESTOQUE_ANIMAL_DETALHE: 'estatisticasrotinaestoqueanimaldetalhe',
  HISTORICO_EXECUCAO_VIEW_PG: 'historicoexecucaoviewpg', // listagem ❌ HTTP 500; busca por id /{id}/ ✅ e sub-rota ultimos-itens-fila/ ✅ — ver getHistoricoExecucaoViewPgUltimosItensFila()

  // Propriedade/estabelecimento/entidades
  ESTABELECIMENTO_RURAL_EXTERNO: 'estabelecimentoruralexterno',
  ESTABELECIMENTO_RURAL_INTERNO_EXTERNO: 'estabelecimentoruralinternoexterno',
  PROPRIETARIO: 'proprietario',
  PROPRIETARIO_CONTATO: 'proprietariocontato',
  SETOR: 'setor',

  // Fiscal/financeiro (cadastro, não movimento)
  COFINS_ST: 'cofinsst',
  ICMS_ORIGEM: 'icmsorigem',
  ICMS_ST: 'icmsst',
  PIS_SITUACAO_TRIBUTARIA: 'pissituacaotributaria',
  NATUREZA_OPERACOES: 'naturezaoperacoes',
  CONDICOES_VENDA: 'condicoesvenda',
  CATEGORIA_DE_CONTATO: 'categoriadecontato',
  TIPO_DE_CATEGORIA_DE_CONTATO: 'tipodecategoriadecontato',
  CENTRO_DE_CUSTO: 'centrodecusto',
  CONTA_RATEIO: 'contarateio',
  SITUACAO_MOVIMENTACAO_MATERIAL: 'situacaomovimentacaomaterial',
  TIPO_VENDA_DESCARTE_DEVOLUCAO: 'tipovendadescartedevolucao',
  UNIDADE_COTACAO: 'unidadecotacao',
  TIPOS_ADV: 'tiposadv',
}

// Módulos de reprodução/genética/sêmen/embrião: rotas REST reais e
// funcionais, que só trazem dados se a conta usa o módulo correspondente no
// MB (sem uso, devolvem 0 registros — não é limite de requisições). Mantidos à parte
// para não poluir ERP_SLUGS.
export const REPRODUCAO_SLUGS = {
  CIO: 'cio',
  ESTACAO_MONTA: 'estacaomonta',
  ESTACAO_MONTA_IA: 'estacaomontaia',
  ACASALAMENTO: 'acasalamento',
  RESULTADO_SEXAGEM: 'resultadosexagem',
  RESULTADO_DIAGNOSTICO_GESTACAO: 'resultadodiagnosticogestacao',
  AVALIACAO_OVARIANA: 'avaliacaoovariana',
  ASPIRACAO_OVOCITOS: 'aspiracaoovocitos',
  SAFRA_ANIMAL: 'safraanimal',
  AVALIACAO_ATIVO: 'avaliacaoativo',
  COMPRA_SEMEN: 'comprasemen',
  COMPRA_SEMEN_ITEM: 'comprasemenitem',
  VENDA_SEMEN: 'vendasemen',
  VENDA_SEMEN_ITEM: 'vendasemenitem',
  MOVIMENTACAO_SEMEN: 'movimentacaosemen',
  COMPRA_EMBRIAO: 'compraembriao',
  VENDA_EMBRIAO_GRUPO: 'vendaembriaogrupo',
  TRANSFERENCIA_LOTE_REPRODUTIVO: 'transferencialotereprodutivo',
  TRANSFERENCIA_LOTE_GENETICO: 'transferencialotegenetico',
  COMUNICACAO_ABCZ_ONLINE: 'comunicacaoabczonline',
  PROBLEMA: 'problema',
  ANO_AGRICOLA: 'anoagricola',
  CICLO_PRODUCAO: 'cicloproducao',
  CICLO_PRODUCAO_LOCALIDADE: 'cicloproducaolocalidade',
  CENTRO_DISTRIBUICAO: 'centrodistribuicao',
  SAFRA: 'safra',
  // Módulo agrícola (não-pecuário) — só traz dados se o módulo é usado.
  ATIVIDADE_AGRICOLA: 'atividadeagricola',
  CLASSIFICACAO: 'classificacao',
  REGRA_TRIBUTARIA: 'regratributaria',
  VARIEDADE: 'variedade',

  // Mais reprodução/genética.
  ACASALAMENTO_COBERTURA: 'acasalamentocobertura',
  AGRUPADOR_COBERTURAS_ABCZ: 'agrupadorcoberturasabcz',
  AGRUPADOR_COBERTURAS_ABCZ_COBERTURAS: 'agrupadorcoberturasabczcoberturas', // ❌ HTTP 500
  AGRUPADOR_MORTES_ABCZ: 'agrupadormortesabcz',
  AGRUPADOR_MORTES_ABCZ_MORTES: 'agrupadormortesabczmortes', // ❌ HTTP 500
  AGRUPADOR_NASCIMENTOS_ABCZ: 'agrupadornascimentosabcz',
  AGRUPADOR_NASCIMENTOS_ABCZ_NASCIMENTOS: 'agrupadornascimentosabcznascimentos', // ❌ timeout 60s (antes HTTP 500)
  AGRUPADOR_PESAGENS_ABCZ: 'agrupadorpesagensabcz',
  AGRUPADOR_PESAGENS_ABCZ_PESAGENS: 'agrupadorpesagensabczpesagens', // ❌ HTTP 500
  CDC_FIV: 'cdcfiv',
  COBERTURA_DIAGNOSTICO_GESTACAO: 'coberturadiagnosticogestacao',
  COBERTURA_TE: 'coberturate',
  COBRANCA_ASPIRACAO_OVOCITOS: 'cobrancaaspiracaoovocitos',
  CRUZAMENTOS: 'cruzamentos',
  DESCARTE_REPRODUTOR: 'descartereprodutor',
  DETALHE_SITUACAO_MACHO: 'detalhesituacaomacho',
  ESTACAO_MONTA_CAMPO: 'estacaomontacampo',
  ESTACAO_MONTA_CONTROLADA: 'estacaomontacontrolada',
  ESTACAO_MONTA_TE: 'estacaomontate',
  FEMEA: 'femea',
  GRUPO_EVENTO: 'grupoevento',
  IDENTIFICACAO_ACASALAMENTO: 'identificacaoacasalamento',
  LOTE_GENETICO: 'lotegenetico',
  LOTE_REPRODUTIVO: 'lotereprodutivo',
  MBIVF_WEB_FEMEA: 'mbivfwebfemea',
  MBIVF_WEB_FEMEA_RECEPTORA: 'mbivfwebfemeareceptora',
  MBIVF_WEB_SEMEN: 'mbivfwebsemen',
  MEDICOES_GENETICAS: 'medicoesgeneticas',
  MEDICOES_MORFOLOGICAS: 'medicoesmorfologicas',
  MOTIVO_CANCELAMENTO: 'motivocancelamento',
  MOTIVO_VISITA: 'motivovisita',
  ORIGEM_SEMEN: 'origemsemen',
  PARAMETROS_PREVISAO: 'parametrosprevisao',
  PRODUTO_FIV: 'produtofiv',
  RAQUE: 'raque',
  RESULTADO_DIAGNOSTICO_GESTACAO_MODAL: 'resultadodiagnosticogestacaomodal',
  SCORE_FEZES: 'scorefezes',
  TIPO_DESCARTE_EMBRIAO: 'tipodescarteembriao',
  TIPO_OCORRENCIA: 'tipoocorrencia',
  TIPO_PROBLEMA: 'tipoproblema',
  TIPO_PRODUTO_FIV: 'tipoprodutofiv',
  TOURO_MULTIPLO: 'touromultiplo',
  TRATAMENTO_ANIMAL_DOENCA: 'tratamentoanimaldoenca',
  VISITAS_RGN_RGD: 'visitasrgnrgd',
  PLANEJAMENTO_SAFRA: 'planejamentosafra', // ❌ HTTP 500
}

// Financeiro: mesma situação — rotas reais, que só trazem dados se a conta
// usa o módulo financeiro do MB.
export const FINANCEIRO_SLUGS = {
  BANCO: 'banco',
  ORCAMENTO: 'orcamento',
  MOVIMENTACAO_FINANCEIRA: 'movimentacaofinanceira',
  MOVIMENTACAO_FINANCEIRA_CONTA: 'movimentacaofinanceiraconta',
  CONTA_FINANCEIRO: 'contafinanceiro',
  COTACOES_DIARIAS: 'cotacoesdiarias',

  // Mais financeiro.
  BAIXAR_MOVIMENTACAO_FINANCEIRA: 'baixarmovimentacaofinanceira',
  COBRANCA_MOVIMENTACAO_FINANCEIRA: 'cobrancamovimentacaofinanceira',
  CONCILIACAO_MOVIMENTACAO_FINANCEIRA: 'conciliacaomovimentacaofinanceira',
  CONTAS_PAGAR: 'contaspagar',
  CONTAS_RECEBER: 'contasreceber',
  EMPRESTIMO: 'emprestimo',
  GRUPO_RATEIO_CONTA_FINANCEIRA: 'gruporateiocontafinanceiro',
  MOVIMENTACAO_FINANCEIRA_ARQUIVOS: 'movimentacaofinanceiraarquivos',
  OPCAO_PAGAMENTO: 'opcaopagamento',
  ORCAMENTO_CONTRATO: 'orcamentocontrato',
  PROJETO_FINANCEIRO: 'projetofinanceiro',
  RETER_MOVIMENTACAO_FINANCEIRA: 'retermovimentacaofinanceira',
  TRANSFERENCIA_BANCARIA: 'transferenciabancaria',
  REGRA_PAUTA: 'regrapauta',
  CUSTOS_MENSAIS_ANIMAIS: 'custosmensaisanimais', // complementa custoporanimal
}

// Outras rotas reais que dependem de módulos específicos do MB: equipamentos
// de curral/confinamento, gestão de contratos (módulo comercial à parte) e
// vendas/pedidos avulsos. Mesma situação de REPRODUCAO_SLUGS/FINANCEIRO_SLUGS.
export const OUTROS_SLUGS = {
  // Equipamentos de curral/cocho
  BEBEDOURO: 'bebedouro',
  BOTIJAO: 'botijao',
  CANECA: 'caneca',
  COCHO_COMPARTILHADO: 'cochocompartilhado',
  LIMPEZA_BEBEDOURO: 'limpezabebedouro',
  MANUTENCAO_ATIVO_MAQUINARIO: 'manutencaoativomaquinario',
  ARVORE_DE_PROCESSO: 'arvoredeprocesso',
  RECURSO_EM_TALHAO: 'recursoemtalhao',

  // Gestão de contratos (módulo comercial separado)
  CONTRATO_PROGRAMA_SEQUENCIAS: 'contratoprogramasequencias',
  CONTRATOS_VINCULADOS: 'contratosvinculados',
  EVENTO_GESTAO_CONTRATOS: 'eventogestaocontratos',
  EVENTOS_CONTATO: 'eventoscontato',
  GESTAO_CONTRATOS: 'gestaocontratos',
  MENSAGENS_GESTAO_CONTRATOS: 'mensagensgestaocontratos',
  MENSAGENS_GESTAO_CONTRATOS_ITENS: 'mensagensgestaocontratositens',
  PARCERIA: 'parceria',
  EVENTO_CAVALGADA_2018: 'eventocavalgada2018', // evento pontual antigo, claramente descontinuado

  // Agrícola / produção / vendas avulsas
  PROCESSO_PRODUCAO: 'processoproducao',
  PRODUCAO: 'producao',
  PRODUCAO_PASTO: 'producaopasto',
  PRODUCAO_PREMISTURA: 'producaopremistura',
  PRODUTOS_CATEGORIA_ANIMAIS: 'produtoscategoriaanimais',
  PROGRAMA_NUTRICIONAL_PASTO: 'programanutricionalpasto',
  PROGRAMA_NUTRICIONAL_PASTO_RACA: 'programanutricionalpastoraca',
  SAIDA_TRANSFERENCIA_CENTRO_DISTRIBUICAO: 'saidatransferenciacentrodistribuicao',
  SITUACAO_CONTATO: 'situacaocontato',
  USO_PESSOAL_EPI: 'usopessoalepi',
  IMPORTACAO_XML_NFE: 'importacaoxmlnfe',
  ORIGEM_MOVIMENTACAO_MATERIAL: 'origemmovimentacaomaterial',
  MOTIVO_PERDA_MOVIMENTACAO_MATERIAL: 'motivoperdamovimentacaomaterial',
  VENDA_AVULSA: 'vendaavulsa',
  VENDA_COMPLEMENTAR: 'vendacomplementar',
  VENDA_CONTRATO: 'vendacontrato',
  VENDA_GENERICA: 'vendagenerica',
  PEDIDO_ENTRADA: 'pedidoentrada',
  PEDIDOS_VENDAS: 'pedidosvendas',
  PEDIDO_VENDA: 'pedidovenda',
  RACAO_PREMISTURA: 'racaopremistura', // ❌ HTTP 500
  ESTOQUE_RELATORIO_INSUMOS: 'estoque-relatorio-insumos', // ❌ HTTP 500
  ESTOQUE_RELATORIO_INSUMOS_ITENS: 'estoque-relatorio-insumos-itens',

  // Diversos
  AGENDAMENTO_ATIVIDADE: 'agendamentoatividade',
}

export const CUSTO_PATHS = {
  INDIRETO: 'custoporanimal/custo-indireto-erp',
  ATIVOS: 'custoporanimal/exportacao-custos-animais-ativos-erp-v2',
  VENDIDOS: 'custoporanimal/exportacao-custos-animais-vendidos-erp-v2',
  MORTOS: 'custoporanimal/exportacao-custos-animais-mortos-erp-v2',
  SALDO_BIOLOGICO: 'custoporanimal/saldo-ativo-biologico-erp',
  BUSCAR_SAIDAS: 'movimentacaomaterial/buscar-saidas',
}

// Tipos de saída de material — usar com getSaidasMaterial()
export const TIPO_SAIDA_MATERIAL = {
  VENDA: 2,
  PERDA: 3,
  CONSUMO_GERAL: 4,
  ORCAMENTO: 5,
  USO_PESSOAL_EPI: 8,
  NUTRICIONAL_PASTO: 20,
  PRODUCAO_RACAO: 22,
  PRODUCAO_PRE_MISTURA: 23,
  NUTRICIONAL_CONFINAMENTO: 24,
  TRATAMENTO_ANIMAIS: 25,
  MANUT_MAQUINARIOS: 27,
  ATIVO_FIXO: 28,
  PROCESSAMENTO: 30,
  AJUSTE_INVENTARIO: 31,
}
