# Como contribuir

Obrigado pelo interesse! Este é um cliente **não oficial** da API de Integração MultBovinos, escrito em JavaScript (ESM) com tipos em `.d.ts`.

## Preparando o ambiente

- Node.js 22 ou mais novo.
- `npm ci` para instalar as dependências de desenvolvimento (o pacote não tem dependências de produção).

## Antes de abrir um pull request

Rode:

```sh
npm run verify
```

Ele roda lint, formatação (Prettier), checagem de tipos e os testes com **100% de cobertura obrigatória** (linhas, ramos, funções e instruções). Código novo vem com teste; um ramo genuinamente inalcançável pode usar `/* c8 ignore */` com a justificativa ao lado.

Regras dos testes:

- **Nunca** chamam a API real nem a rede, e não precisam de credenciais: usam `fetch` falso.
- `npm run test:live` é opcional e manual — roda contra a API real com as **suas** credenciais (`MB_EMAIL`/`MB_PASS` no ambiente), só faz leituras, e **seleciona uma fazenda no servidor**: não rode ao mesmo tempo que outro processo que use a mesma conta.

## Commits e PRs

- Mensagens no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`); mudança incompatível com `!` (ex.: `feat!:`).
- Atualize o `CHANGELOG.md` (seção `[Unreleased]`) e, se a API pública mudar, o `index.d.ts`/`src/*.d.ts` — o teste `types-parity` confere que tipos e código batem.
- Nunca inclua credenciais, tokens ou dados reais de fazendas em código, testes ou issues.

Opcional: `git config core.hooksPath .githooks` ativa um _pre-commit_ local que procura segredos antes do commit (precisa de `node` no PATH). O GitHub também faz a varredura de segredos no push.

## Código de conduta

Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md).
