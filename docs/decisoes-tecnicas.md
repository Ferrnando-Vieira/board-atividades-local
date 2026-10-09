# Decisões técnicas — fundação do board de atividades (rodada 1)

Data: 01/10/2026. Escopo: fundação persistente e configuração administrativa de primeira execução. A interface Kanban, links de compartilhamento, API e anexos ficam para as próximas rodadas; nesta rodada eles têm apenas a base de dados.

## 1. Ambiente inspecionado

| Item    | Valor encontrado                                                    |
| ------- | ------------------------------------------------------------------- |
| Sistema | Windows (win32-x64), PowerShell 5.1                                 |
| Node.js | 26.3.1 (ABI 147, N-API 10, SQLite embutido 3.53.1)                  |
| npm     | 12.0.2 — bloqueia scripts de instalação por padrão (`allowScripts`) |
| Git     | 2.56.0                                                              |

Os scripts bloqueados pelo npm 12 (esbuild, unrs-resolver, @parcel/watcher e o `node-gyp rebuild` implícito do better-sqlite3) não são necessários neste host: todos os binários nativos vêm pré-compilados nos pacotes e foram carregados com sucesso. Nada foi liberado em `allowScripts`. Em outra plataforma sem binário pré-compilado, aprove só o necessário com `npm install-scripts approve <pacote>`.

## 2. Convenções adotadas

| Aspecto    | Decisão                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| TypeScript | 5.9.3, `strict` + `noUncheckedIndexedAccess`                                                                  |
| Tailwind   | 4.3.3 com tokens em `@theme`                                                                                  |
| Lint       | ESLint 9 flat config + `eslint-config-next` + `eslint-config-prettier`                                        |
| Formatação | Prettier com 2 espaços, aspas simples e 80 colunas                                                            |
| Estrutura  | `app/` fino, `screens/`, `components/`, `config/`, `types/`, `util/` e `servidor/` para código só de servidor |
| Textos     | `textos*.ts` por tela (sem i18n)                                                                              |
| Erros      | `ErroApp` estendendo `Error` (mensagem, status e `codigo`), para manter a stack no servidor                   |

Não usados, com motivo: cliente HTTP e proxy de API externa (não há API externa), biblioteca de estado de cliente (sem estado de cliente nesta rodada), `next/font/google` (busca fontes na internet durante o build), React Compiler (custo extra de build sem ganho para telas tão pequenas), biblioteca de toasts (os erros desta rodada são de formulário e aparecem junto ao campo) e faixas `^` nas versões (aqui tudo é fixado em versão exata).

## 3. Versões fixadas

| Pacote                                 | Versão           | Motivo                                                                                                                                           |
| -------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| next / eslint-config-next / @next/env  | 16.3.8           | Versão estável marcada como Active LTS e com a correção de segurança de 30/09/2026                                                               |
| react / react-dom                      | 19.2.8           | Versão que o `create-next-app` 16.3.8 instala                                                                                                    |
| typescript                             | 5.9.3            | O TypeScript 7 é aceito pelo Next 16.3, mas o `typescript-eslint` 8.71 exige versão `< 6.1`                                                      |
| eslint                                 | 9.39.5           | `eslint-plugin-react` 7.37.5 (dependência do `eslint-config-next`) não aceita ESLint 10. O npm marca a linha 9 como sem suporte (ver limitações) |
| tailwindcss / @tailwindcss/postcss     | 4.3.3            | Última correção da linha 4.3                                                                                                                     |
| zod                                    | 4.6.5            | API do Zod 4 (`z.iso.date`, `z.iso.time`, `z.stringbool`, `z.flattenError`) conferida na documentação oficial                                    |
| drizzle-orm / drizzle-kit              | 0.45.3 / 0.31.11 | Linha estável. A 1.0 ainda está em RC                                                                                                            |
| better-sqlite3 / @types/better-sqlite3 | 13.0.3 / 9.6.0   | Primeira versão em N-API: o binário pré-compilado roda no Node 26 sem compilar nada                                                              |
| jest / @types/jest                     | 30.5.2 / 30.0.0  | Executor do ecossistema do usuário (convenção de testes Jest); configurado via `next/jest`                                                       |
| tsx                                    | 4.23.15          | Executa os scripts TypeScript com o alias `@/`                                                                                                   |
| server-only                            | 0.0.1            | Impede que módulos de sessão/cookie entrem no bundle do cliente                                                                                  |
| @types/node                            | 22.20.4          | Coerente com `engines.node >= 22` (mínimo exigido pelo better-sqlite3 13)                                                                        |
| prettier / eslint-config-prettier      | 3.9.9 / 10.1.8   | Formatação do projeto                                                                                                                            |

O `.npmrc` usa `save-exact=true`, então instalações futuras também gravam a versão exata.

## 4. Persistência

**ORM: Drizzle + better-sqlite3.** O esquema fica em TypeScript (`servidor/banco/esquema/`, um arquivo por responsabilidade) e o `drizzle-kit generate` gera SQL versionado em `servidor/banco/migracoes/`. O migrador aplica as migrações pendentes numa única transação e as registra em `__drizzle_migrations`, então reaplicar não altera nada. O `drizzle-kit push` não é usado, para que o banco nunca mude fora do histórico de migrações.

Alternativas descartadas:

- Prisma: a versão `latest` no npm é 8.0.0-rc; a 7.x exige gerar o cliente e baixar o motor de migração, e não expressa CHECK nem índice parcial no esquema.
- `node:sqlite` (embutido no Node): o Drizzle só tem esse driver na linha 1.0 (RC/beta).
- libsql: abre uma conexão nova a cada transação, o que tornaria incerta a aplicação de `PRAGMA foreign_keys` e de `busy_timeout`.

**Integridade:**

- Toda conexão liga `foreign_keys`, `busy_timeout` = 5 s, WAL e `synchronous=NORMAL`.
- Há CHECK para prioridade 0..9 (padrão 5), formatos de data/hora/instante, booleanos, tamanhos de texto, hashes SHA-256 em hexadecimal, coerência de prazo, conclusão e lembrete, catálogo de permissões e faixa de prioridade dos links.
- Chaves estrangeiras usam RESTRICT por padrão. CASCADE só aparece em tabelas de junção puras e em sessões.
- A ordem manual (`ordem`) é única por status entre atividades não arquivadas (índice único parcial). Ela é independente da prioridade.
- A posição de status é única por board. Reordenar exige atualizar em duas fases dentro de uma transação, porque o SQLite não adia UNIQUE.

**Concorrência:**

- Escritas de serviço usam transação `IMMEDIATE` síncrona (better-sqlite3): ou tudo é gravado, ou nada.
- Entidades editáveis (board, status, atividades, links) têm a coluna `versao`. `exigirAtualizacaoComVersao` recusa com 409 a atualização feita sobre versão desatualizada, já usada em `atualizarConfiguracaoBoard`.
- O cadastro de tags e solicitantes faz `INSERT … ON CONFLICT DO NOTHING` e depois `SELECT`; a unicidade fica a cargo do índice único.
- A tabela `administrador` aceita um único registro (`CHECK id = 1`). Duas configurações iniciais concorrentes não criam dois administradores.

| Requisito            | Tabelas                                                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board e configuração | `boards` (nome, fuso, versão)                                                                                                                                                                                                                             |
| Status ordenáveis    | `status_board` (chave estável, posição única, `finaliza_atividade`)                                                                                                                                                                                       |
| Atividades           | `atividades` (título, descrição, prioridade, ordem, arquivamento, prazo data + hora opcional, conclusão, lembrete em UTC com situação `pendente`/`disparado`/`cancelado`, timestamps)                                                                     |
| Tags N:N             | `tags` + `atividades_tags` (chave normalizada única por board)                                                                                                                                                                                            |
| Solicitantes         | `solicitantes` (chave normalizada única por board)                                                                                                                                                                                                        |
| Anexos privados      | `anexos` (somente metadados; o arquivo usa um identificador aleatório como nome e fica em `DIRETORIO_ANEXOS`, que é recusado se estiver dentro de `public/`)                                                                                              |
| Credencial e sessão  | `administrador`, `codigo_configuracao_inicial`, `sessoes_administrativas`                                                                                                                                                                                 |
| Compartilhamento     | `links_compartilhamento` (token só por hash) + escopo normalizado: `escopo_link_status`, `escopo_link_tags`, `escopo_link_solicitantes`, faixa de prioridade e `incluir_arquivadas`. Na mesma dimensão os valores combinam com OU; entre dimensões, com E |
| Tokens de API        | `tokens_api` (hash + prefixo público) + `tokens_api_permissoes` (catálogo inicial: `board:ler`, `atividades:ler`, `atividades:escrever`, `anexos:ler`, `anexos:escrever`)                                                                                 |

Normalização de nomes (`util/NormalizacaoUtils.ts`): o nome exibido é o texto em NFC, sem espaços nas pontas e com espaços internos colapsados. A chave remove acentos e ignora maiúsculas/minúsculas (`"Revisão  TECNICA"` e `"Revisão técnica"` são a mesma tag). Fica gravado o nome da primeira ocorrência.

## 5. Autenticação e autorização

- **Primeira execução sem senha fixa.** `npm run inicializar` cria um código de uso único (80 bits, base32 de Crockford) e o mostra só no terminal do servidor. O banco guarda apenas o SHA-256 do código. O código vale 60 minutos e é invalidado após 5 tentativas erradas. A tela `/configuracao-inicial` exige esse código, o que impede outra pessoa da rede de assumir a conta antes do proprietário. O código é conferido antes do scrypt e de novo na transação que cria o administrador e consome o código. Depois de configurada, a tela redireciona para `/entrar`.
- **Senha.** scrypt com N=2^16, r=8, p=2 (recomendação OWASP), sal de 16 bytes, normalização NFKC e comparação em tempo constante. O formato `scrypt$N=…` permite recalcular o hash ao entrar quando os parâmetros mudarem. No máximo 2 cálculos rodam ao mesmo tempo (~64 MiB cada).
- **Entrada.** Após 5 falhas, o acesso fica bloqueado por 15 minutos; o bloqueio é gravado no banco. A mensagem de erro não diz se errou o usuário ou a senha.
- **Sessão.** Token aleatório de 256 bits num cookie `HttpOnly` com `SameSite=Strict` e `Secure` quando `COOKIE_SEGURO=true`. Sem prazo fixo: cada uso renova a validade por 400 dias (o teto de validade de cookie em navegadores como Chrome e Edge). No banco, `validarSessao` renova no máximo a cada 5 minutos, junto com o registro de uso. No navegador, o `proxy.ts` regrava o cookie em toda navegação GET, sem consultar o banco (um token revogado continua recusado). Fica de fora dos POST para não disputar a resposta com as ações de entrar e sair. A sessão termina em Sair ou depois de 400 dias sem uso. O banco guarda só o SHA-256 do token. Sair revoga a sessão no banco.
- **Tokens futuros** (links e API) já têm tabelas que só aceitam hash SHA-256: o CHECK recusa outro formato.
- **Autorização no servidor.** Cada página chama a DAL (`servidor/web/acessoAdministrativo.ts`) antes de renderizar. Não existe nenhum Route Handler (`app/api`). Nesta rodada, as únicas Server Actions são `entrar`, `sair` e `concluirConfiguracao`; as duas primeiras dependem de credencial ou código válidos, e as Server Actions têm verificação de Origin embutida no Next. O `proxy.ts` não foi usado como barreira de segurança. As ações de gestão da rodada 2 seguem a mesma regra e estão descritas em `docs/decisoes-tecnicas-kanban.md`.
- **Cabeçalhos.** `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` (os links de compartilhamento futuros terão token na URL), `Permissions-Policy` e sem `X-Powered-By`.
- **Rede.** O `HOST` padrão é `127.0.0.1`. Se o host não for local, o lançador avisa que o board fica acessível na LAN e que a porta não deve ser exposta à internet. Esta rodada não criou túnel nem redirecionamento de portas.

## 6. Instalação limpa

- **Board vazio.** `npm run inicializar` cria só o board, os status iniciais (A Fazer, Em Andamento, Bloqueados, Concluídos) e o código de configuração. Nenhuma atividade, tag ou nome de pessoa vem pré-cadastrado, e as migrações não carregam dados.
- **Solicitante padrão configurável.** É o nome gravado quando uma atividade é salva sem solicitante. Desde a migração 0007 ele é uma marca `solicitantes.padrao` (no máximo um por board, por índice único parcial), informada em `/configuracao-inicial` na mesma transação que cria o administrador e alterável depois na página **Solicitantes**. Sem padrão definido, a atividade sem solicitante é recusada (`solicitante-obrigatorio`). Em bancos anteriores à 0007, o padrão nascia junto com o board e por isso é o solicitante mais antigo; a migração marca esse.

## 7. Testes

Os testes usam Jest 30 com `next/jest` (SWC), ambiente `node`, SQLite em memória já migrado, nomes em pt-BR e o padrão Arrange/Act/Assert, em `tests/` espelhando o código. Cobrem:

- migração, constraints e WAL em arquivo;
- inicialização idempotente e concorrência otimista;
- normalização de tags e solicitantes, no utilitário e no banco;
- scrypt e tokens;
- configuração de primeira execução (código, expiração, tentativas, recusa da segunda configuração);
- entrada, bloqueio e sessões;
- datas, fusos e variáveis de ambiente.

Por causa do scrypt, `maxWorkers` é 2.

## 8. Como usar

Desde a rodada 5, as instruções de instalação, execução, rede local, backup e manutenção ficam só no `README.md`, que substitui a lista de comandos desta seção. Para um banco novo bastam `npm ci` e `npm run inicializar`; um banco de uma versão anterior precisa de `npm run db:migrar` antes de usar as versões seguintes.

## 9. Limitações conhecidas

- Sem HTTPS, quem estiver na mesma rede pode capturar a senha e o cookie de sessão. Para uso fora desta máquina, coloque um proxy TLS na frente do board e use `COOKIE_SEGURO=true`, ou mantenha `HOST=127.0.0.1`.
- O bloqueio de entrada vale para a conta inteira: alguém da LAN pode errar a senha de propósito e bloquear o acesso por 15 minutos.
- Ainda não há Content-Security-Policy (precisaria de nonce via `proxy.ts`).
- Nesta rodada a interface era só uma visão de leitura. Edição, movimentação e reordenação no Kanban e a gestão de status, tags e solicitantes chegaram na rodada 2 (`docs/decisoes-tecnicas-kanban.md`). Ainda não existem CRUD de links, API, upload de anexos nem o disparador de lembretes; para eles existem apenas tabelas, constraints e a consulta `listarLembretesPendentes`.
- Links de compartilhamento, API para agentes, busca e download de anexos chegaram na rodada 3 (`docs/decisoes-tecnicas-compartilhamento-api.md` e `docs/api-agentes.md`), com a migração 0001.
- Envio e remoção de anexos, fundo do board e lembretes com notificações locais chegaram na rodada 4 (`docs/decisoes-tecnicas-anexos-personalizacao-lembretes.md`), com a migração 0002.
- `npm audit`: 0 vulnerabilidades nas dependências de produção. Nas de desenvolvimento há 4 moderadas (GHSA-67mh-4wv8-2f99: esbuild 0.18 trazido pelo drizzle-kit via `@esbuild-kit`). A falha afeta o servidor de desenvolvimento do próprio esbuild (`serve`), que não é usado aqui. A correção oferecida pelo npm rebaixaria o drizzle-kit, por isso não foi aplicada.
- O npm avisa que o ESLint 9.39.5 está fora da janela de suporte. A troca pelo ESLint 10 depende de o `eslint-config-next` aceitar essa versão.
- Validado apenas no Node 26.3.1 com Windows x64; o `engines` declara `>= 22` com base nos requisitos das dependências.
- Adicionar uma permissão ao catálogo de API exige nova migração (CHECK).
- Nenhum `README.md` foi criado nesta rodada; ele chegou na rodada 5, com instalação no Windows, rede local, segurança, backup e restauração (`npm run backup:criar`, `backup:verificar` e `backup:restaurar`).
