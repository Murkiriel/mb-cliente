// Leitura comum dos endpoints BI (interno): toda resposta vem no envelope
// { dados: [...] } — ausente quando não há registros — e vira { items, count }.
// query undefined → GET sem parâmetros (os cadastros e os por fazenda sem
// filtro de data). timeoutMs: prazo só desta chamada (padrão: o da instância).
export async function getDados(client, slug, query, { timeoutMs } = {}) {
  const path = `/integracaobi/${slug}`
  let request
  if (timeoutMs !== undefined) request = client.get(path, query ?? {}, { timeoutMs })
  else request = query === undefined ? client.get(path) : client.get(path, query)
  const data = await request
  const items = data.dados ?? []
  return { items, count: items.length }
}
