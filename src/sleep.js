// Espera interrompível: um AbortSignal abortado rejeita com o reason dele
// (interno do SDK — fora do mapa de exports).
export function sleep(ms, signal) {
  // Um signal que já abortou não dispara mais o evento 'abort'.
  if (signal?.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    // O mesmo signal costuma durar o processo inteiro (o da instância): sem
    // tirar o listener quando a espera termina normalmente, cada sleep
    // deixaria um pendurado nele.
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
