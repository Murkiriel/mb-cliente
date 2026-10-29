// Marca interna (fora do mapa de exports) que o grid ERP põe no resultado de
// cada página: a geração da fazenda selecionada lida DENTRO da leitura
// compartilhada da página, mais o slug. O paginate() genérico compara a
// geração de cada página com a da primeira — assim a guarda contra troca de
// fazenda no meio da paginação vale para qualquer iterador montado sobre um
// método de grid, não só para grid.pages().
//
// Propriedade não enumerável com chave Symbol: não aparece em toEqual,
// spread nem JSON — quem consome o resultado não vê diferença.
export const SELECTION = Symbol('mb-cliente.selection')
