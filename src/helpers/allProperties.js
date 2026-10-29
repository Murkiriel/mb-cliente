// Itera todas as fazendas SEQUENCIALMENTE.
// selectProperty altera estado no servidor MB — não paralelizável.
// Cada fazenda roda numa seção exclusiva (seleção + callback): outra
// operação da mesma instância não troca a fazenda no meio do callback, e
// chamadas por fazenda feitas DENTRO do callback entram direto (reentrante).
// Cada item retornado recebe _propertyId automaticamente.
export async function forAllProperties(auth, client, callback, propertyIds) {
  const ids = propertyIds ?? auth.getProperties().map((p) => p.id)
  const all = []

  for (const id of ids) {
    await auth.withProperty(client, id, async () => {
      const info = auth.getProperties().find((p) => p.id === id)
      const items = await callback(id, info)
      all.push(...items.map((item) => ({ ...item, _propertyId: id })))
    })
  }

  return all
}
