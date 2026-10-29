// Auxiliares internos das opções por chamada do HttpClient (signal, timeoutMs).

// Só as opções que quem chamou deu: uma chave ausente fica de fora, em vez de
// ir como undefined.
export function callOptions({ signal, timeoutMs } = {}) {
  const options = {}
  if (signal) options.signal = signal
  if (timeoutMs !== undefined) options.timeoutMs = timeoutMs
  return options
}

// Prazo padrão de uma chamada lenta: o sugerido, mas nunca menor que o prazo
// da instância (quem configurou a instância com mais tempo não perde tempo).
export function atLeastInstance(ms, client) {
  return Math.max(ms, client.timeoutMs ?? 0)
}
