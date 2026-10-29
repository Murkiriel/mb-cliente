# Política de segurança

## Versões suportadas

Só a versão mais recente (a última tag `vX.Y.Z` deste repositório) recebe correções de segurança. O pacote não é publicado no npm.

## Como relatar uma vulnerabilidade

**Não abra uma issue pública.** Use o relato privado do GitHub: na página do repositório, aba **Security** → **Report a vulnerability**. Inclua:

- a versão do pacote e do Node.js;
- o que acontece e o impacto esperado;
- um passo a passo mínimo para reproduzir, **sem credenciais reais nem dados de produção**.

Você recebe uma primeira resposta em até 7 dias. Se a falha for confirmada, a correção sai numa versão nova e o relato é publicado como aviso de segurança do GitHub depois que a correção estiver disponível, com crédito a quem relatou (se quiser).

## Escopo

Este pacote é um cliente **não oficial** da API de Integração MultBovinos. Falhas **na própria API do fornecedor** não são deste projeto: relate-as diretamente à MultBovinos, de forma privada. Aqui cabem falhas no código do cliente — por exemplo, vazamento de credenciais ou do token em erros, envio do token a outro host, ou leitura de dados de uma fazenda trocada sem aviso.

## Boas práticas para quem usa

- Guarde `email`/`password` em variáveis de ambiente ou num cofre de segredos, nunca no código nem em arquivos versionados.
- O token JWT devolvido por `connect()` dá acesso à sua conta: trate-o como senha.
