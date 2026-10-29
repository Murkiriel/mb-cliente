import { describe, it, expect, vi } from 'vitest'
import { sleep } from '../src/sleep.js'

describe('sleep', () => {
  it('sem signal: resolve depois do prazo', async () => {
    await expect(sleep(1)).resolves.toBeUndefined()
  })

  it('signal já abortado: rejeita na hora com o reason', async () => {
    const ctrl = new AbortController()
    ctrl.abort(new Error('parou'))
    await expect(sleep(10_000, ctrl.signal)).rejects.toThrow('parou')
  })

  it('abortar no meio da espera rejeita com o reason', async () => {
    const ctrl = new AbortController()
    const pending = sleep(10_000, ctrl.signal)
    ctrl.abort(new Error('cancelado'))
    await expect(pending).rejects.toThrow('cancelado')
  })

  it('esperas completas não deixam listener de abort pendurado no signal', async () => {
    const ctrl = new AbortController()
    const add = vi.spyOn(ctrl.signal, 'addEventListener')
    const remove = vi.spyOn(ctrl.signal, 'removeEventListener')
    for (let i = 0; i < 5; i++) await sleep(1, ctrl.signal)

    expect(add).toHaveBeenCalledTimes(5)
    expect(remove).toHaveBeenCalledTimes(5)
    // Cada remove tira exatamente o listener que o add correspondente pôs.
    add.mock.calls.forEach(([type, listener], i) => {
      expect(type).toBe('abort')
      expect(remove.mock.calls[i]).toEqual(['abort', listener])
    })

    // Abortar depois não roda nenhum listener das esperas já terminadas (cada
    // um chamaria clearTimeout) — só o que for registrado agora.
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    let fired = 0
    ctrl.signal.addEventListener('abort', () => fired++)
    ctrl.abort()
    expect(fired).toBe(1)
    expect(clear).not.toHaveBeenCalled()
    clear.mockRestore()
  })
})
