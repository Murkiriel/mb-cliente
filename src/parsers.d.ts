// Conversores do formato BR da API — exportados em `/parsers`. Os métodos do
// ERP já aplicam parseErpPage; use estes só sobre dados crus (ex.: mb.raw).

/** "1.234,56" → 1234.56; "1.045" → 1045. Inteiro sem pontuação ("045") e
 * qualquer outro valor voltam como vieram. */
export declare function parseBrNumber<T>(value: T): T | number

/** "08/03/2026" → "2026-03-08". Data inexistente ("31/02/2026") e qualquer
 * outro valor voltam como vieram. */
export declare function parseBrDate<T>(value: T): T | string

/** "08/03/2026 14:05" → "2026-03-08 14:05" (segundos, se vierem, ficam). Hora local do servidor,
 * sem fuso. Data ou hora inexistente e qualquer outro valor voltam como vieram. Não é aplicado
 * automaticamente pelo parse do ERP. */
export declare function parseBrDateTime<T>(value: T): T | string

/** Aplica parseBrNumber/parseBrDate em todo o registro (objetos e arrays,
 * recursivo). Nunca converte campos `*_texto`, `*_usual` nem identificadores
 * (`identificacao`, `sisbov`, `codigo`, `documento`, `cpf`, `cnpj`, `cep`,
 * `telefone`, `celular`, `ordem_servico`). */
export declare function parseErpRecord<T = unknown>(record: T, key?: string | number): unknown

/** parseErpRecord em cada item de `page.results`; outro formato volta como veio. */
export declare function parseErpPage<T>(page: T): T

/** Dias corridos, contando as duas pontas ('2026-01-01' → '2026-01-31' = 31).
 * @throws {ValidationError} se from/to não forem datas YYYY-MM-DD válidas. */
export declare function countCalendarDays(from: string, to: string): number
