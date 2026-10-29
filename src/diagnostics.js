import diagnostics_channel from 'node:diagnostics_channel'

// Observabilidade sem interceptador: eventos só de leitura nos canais
// `node:diagnostics_channel` abaixo. Quem quer métricas ou log assina o canal
// (diagnostics_channel.subscribe('mb-cliente:request', fn)); o cliente não
// muda de comportamento com ou sem assinante, e uma exceção no assinante não
// chega a quem chamou (o próprio Node a relata como exceção não capturada).
// Nenhum evento leva token, senha, corpo, query string nem cabeçalho.
export const CHANNELS = {
  request: diagnostics_channel.channel('mb-cliente:request'),
  retry: diagnostics_channel.channel('mb-cliente:retry'),
  relogin: diagnostics_channel.channel('mb-cliente:relogin'),
  propertySwitch: diagnostics_channel.channel('mb-cliente:property-switch'),
  emptyResponse: diagnostics_channel.channel('mb-cliente:empty-response'),
}

// Monta a mensagem só quando há assinante: sem ninguém ouvindo, o custo é uma
// checagem de booleano.
export function publish(channel, message) {
  if (channel.hasSubscribers) channel.publish(message())
}
