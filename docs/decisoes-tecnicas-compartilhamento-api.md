# Decisões técnicas — compartilhamento e API para agentes (rodada 3)

Data: 01/10/2026. Escopo: links de compartilhamento revogáveis (modalidades completa e restrita) e API HTTP local para agentes, ambos sobre a mesma camada de domínio e o mesmo SQLite da interface. As rodadas 1 (`docs/decisoes-tecnicas.md`) e 2 (`docs/decisoes-tecnicas-kanban.md`) continuam valendo. A referência da API está em `docs/api-agentes.md`.

## 1. Migração 0001

| Mudança                                                                                  | Motivo                                                                        |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `links_compartilhamento.modalidade` (`completo` \| `restrito`, padrão `restrito`, CHECK) | A tabela da rodada 1 não distinguia as duas modalidades                       |
| Catálogo de `tokens_api_permissoes` ganhou `board:escrever`                              | Gerenciar status, tags e solicitantes pela API sem usar `atividades:escrever` |

O SQL foi gerado pelo `drizzle-kit generate` e ajustado à mão. O migrador roda todas as migrações numa transação, e dentro dela `PRAGMA foreign_keys=OFF` não tem efeito. Por isso, recriar `links_compartilhamento` faria o `DROP` apagar em cascata o escopo dos links. A modalidade entra com `ALTER TABLE ADD COLUMN` e CHECK de coluna. Só `tokens_api_permissoes` é recriada, porque nenhuma tabela a referencia. Um teste aplica a 0000, grava link, escopo e permissão, aplica a 0001 e confere que nada se perdeu e que não há violação de chave estrangeira.

O banco real (`dados/board-atividades.sqlite`) não foi alterado nesta rodada. Antes de usar a nova versão, execute `npm run db:migrar` (ou `npm run inicializar`). Até lá, o board mostra "migrações pendentes".

## 2. Links de compartilhamento

- **Token:** 32 bytes de `crypto.randomBytes` em base64url (43 caracteres, 256 bits). O banco guarda só o SHA-256; o CHECK recusa outro formato. O endereço completo aparece uma única vez, na resposta da criação. Depois disso só o nome, o escopo e as datas são listados.
- **Endereço:** `URL_BASE_LAN` + `/compartilhado/<token>`. O token fica no caminho, e não num cookie, por três motivos:
  - recarregar a página e abrir rotas internas (detalhe, busca, arquivadas) mantém o mesmo acesso e a mesma restrição;
  - não se mistura com a sessão do administrador no mesmo navegador;
  - o `Referrer-Policy: no-referrer` da rodada 1 já impede que ele vaze para outros sites.
- **Validação a cada requisição** (página, Server Action e download): hash, não revogado, não expirado, do board padrão e, no restrito, com ao menos uma tag ou um solicitante no escopo. Nada fica em cache entre requisições, então revogar ou expirar corta o acesso na requisição seguinte. Token inexistente, revogado, expirado ou malformado recebe a mesma resposta: redirecionamento 307 para `/compartilhado`, uma página fixa sem dado do board. Nos downloads, a resposta é 404.
- **Revogação:** grava `revogado_em` e apaga as linhas de escopo. O link revogado nunca mais vale, e manter o escopo bloquearia (RESTRICT) a exclusão das tags que ele citava. Ele continua na lista como "Revogado".
- **Validade opcional:** 1, 7, 30, 90 ou 365 dias. O último acesso é registrado no máximo a cada 5 minutos, como nas sessões.

## 3. Modalidades

| Aspecto             | Board completo                                                                       | Restrito                                                                    |
| ------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Atividades visíveis | Todas, inclusive sem tags e arquivadas                                               | Tem alguma das tags escolhidas **E** é de algum dos solicitantes escolhidos |
| Grupo vazio         | —                                                                                    | Não filtra (ex.: só solicitante → todas desse solicitante, com ou sem tags) |
| Exigência de filtro | —                                                                                    | Ao menos uma tag ou um solicitante (esquema Zod e validação do token)       |
| Arquivadas          | Sempre                                                                               | Só se "Incluir arquivadas" foi marcado, e só as do escopo                   |
| Edição              | Atividades, movimento, arquivamento, status, tags e solicitantes (como o formulário) | Nenhuma: telas de edição respondem 404 e ações voltam ao quadro sem gravar  |
| Administração       | Nunca: links, tokens de API e conta ficam só na sessão administrativa                | Nunca                                                                       |

A semântica é a do esquema da rodada 1: OU dentro de cada dimensão, E entre dimensões. A mesma função (`montarCondicaoFiltro`) traduz a restrição do link e os filtros da API para SQL. O filtro de quem consulta é aplicado junto (E) com a restrição do acesso, então nunca amplia o escopo. A condição também respeita as dimensões de status e prioridade do esquema, que a interface ainda não oferece.

No restrito, as colunas (nomes dos status) aparecem para dar contexto, mas cartões, contagens e tags exibidas vêm só das atividades do escopo. Tags de uma atividade do escopo aparecem completas, porque fazem parte dela.

## 4. Onde a restrição é aplicada

| Leitura                    | Função                                     | Fora do escopo                                    |
| -------------------------- | ------------------------------------------ | ------------------------------------------------- |
| Quadro                     | `consultarQuadro(…, restricao)`            | Cartão não é enviado                              |
| Detalhe por URL direta     | `consultarDetalheAtividade(…, restricao)`  | 404                                               |
| Arquivadas                 | `listarAtividadesArquivadas(…, restricao)` | Lista vazia; tela 404 se o link exclui arquivadas |
| Busca                      | `buscarAtividades(…, restricao)`           | Não aparece                                       |
| Anexos (lista no detalhe)  | só da atividade já autorizada              | —                                                 |
| Anexos (download)          | `consultarAnexoAutorizado(…, restricao)`   | 404                                               |
| Edição, nova, status, tags | `exigirGestaoCompartilhada`                | 404 no restrito                                   |

As telas são as mesmas do painel, parametrizadas por um `AcessoPainel` (prefixo de rotas, credencial, restrição e capacidades). O componente cliente recebe só o prefixo, a credencial do próprio link e o modo somente leitura. A lista de links, tags e solicitantes do modal só é carregada para o administrador. Os testes renderizam as páginas em HTML (React DOM no servidor) e conferem que títulos, tags e solicitantes fora do escopo não aparecem.

## 5. Server Actions

- As 12 ações de gestão começam por `exigirAcessoGestao(credencial)`:
  - sem credencial, vale a sessão administrativa (comportamento da rodada 2);
  - com credencial, ela precisa ser um link completo válido nesta requisição;
  - link restrito volta ao quadro somente leitura (307), e link inválido vai para `/compartilhado`, sempre sem gravar.
- A credencial chega num campo oculto (`tokenCompartilhamento`) ou no segundo argumento das ações do quadro. Uma Server Action não tem outra forma de saber de qual link veio o envio. A verificação de Origin do Next continua valendo.
- Os redirecionamentos depois de salvar ficam dentro do mesmo acesso (`/compartilhado/<token>/…`).
- Criar e revogar links e tokens de API são ações à parte, que exigem só a sessão administrativa e ignoram qualquer credencial de link.

## 6. API

- **Camadas:** cada `app/api/v1/**/route.ts` só reexporta os métodos montados em `servidor/api/rotas/*`. Essas rotas usam os mesmos esquemas (`esquemaNovaAtividade`, `esquemaEdicaoAtividade`, `esquemaNovoStatus`…) e serviços da interface. Não existe segundo caminho de gravação.
- **Validação em duas etapas:**
  1. Um esquema estrito de tipos JSON (`z.strictObject`): campo desconhecido ou tipo errado vira 400, com mensagens do locale pt-BR do Zod.
  2. O esquema do domínio, com as mesmas regras e mensagens do formulário.
- **Respostas:** cada resposta passa por um esquema de saída (`respostaApi`), que descarta campo fora do contrato e transforma formato errado em 500.
- **Ordem fixa em toda rota:** instalação pronta (503), token Bearer válido (401, com `WWW-Authenticate`), permissões do catálogo (403) e só então a operação.
  - Os métodos não implementados respondem 405 em JSON, com `Allow`.
  - Caminhos sem rota em `/api` respondem 404 em JSON.
  - Os dois casos também exigem token.
- **Catálogo único** (`servidor/api/catalogoApi.ts`): método, caminho, permissão e descrição de cada endpoint. Ele alimenta as permissões exigidas pelas rotas, o `GET /api/v1`, a tela Integrações e um teste que chama cada endpoint documentado.
- **Tokens de API:**
  - formato `bat_` + 43 caracteres; o banco guarda o SHA-256 e um prefixo de 12 caracteres para identificação;
  - permissões em tabela própria e validade opcional;
  - emissão, listagem e revogação só na tela Integrações, com sessão administrativa;
  - token de link nunca vale como token de API, nem o contrário.
- **Movimento por posição:** a API não pede a coluna inteira como a interface. `moverAtividadeParaPosicao` e `moverStatusParaPosicao` montam a ordem dentro da mesma transação a partir da ordem gravada e reutilizam o núcleo do movimento da rodada 2 (versão, conclusão e gravação em duas fases).
- **PATCH parcial:** os campos omitidos vêm do estado gravado. A versão é conferida antes da mesclagem e de novo na transação de `editarAtividade`.
- **Limites:**
  - corpo de até 256 KiB, lido em fluxo e interrompido no limite;
  - `Content-Type: application/json` obrigatório;
  - parâmetros de consulta desconhecidos ou repetidos são recusados, para que um filtro digitado errado não vire "sem filtro";
  - não há CORS: navegadores de outras origens não leem as respostas.

## 7. Busca e anexos

- **Busca:** todas as palavras precisam aparecer no título, na descrição, no solicitante ou nas tags, sem diferença de acento e caixa (`util/BuscaUtils.ts`). A busca existe no painel, nos links (sempre com a restrição) e na API (`busca=`).
- **Anexos:** esta rodada entrega só o caminho de leitura, porque o envio ainda não existe:
  - lista no detalhe;
  - download por `/anexos/<id>` (sessão) e `/compartilhado/<token>/anexos/<id>` (link), sempre com `application/octet-stream`, `Content-Disposition: attachment` e `nosniff`;
  - o arquivo só é aberto dentro de `DIRETORIO_ANEXOS`, pelo identificador validado.

## 8. Interface

- **Quadro do administrador:** botão **Compartilhar board** abre um `<dialog>` nativo com o formulário (nome, modalidade, tags, solicitantes, arquivadas, validade). O link gerado aparece com **Copiar**. Fora de HTTPS ou localhost a API de área de transferência não existe; nesse caso o texto fica selecionado para Ctrl+C. A mesma tela lista os links com situação e escopo e revoga com confirmação.
- **Navegação:**
  - "Busca" para todos;
  - "Integrações" (tokens, endereço base e catálogo) só para o administrador;
  - no link, o cabeçalho mostra o nome do link e "Somente leitura" ou "Pode ver e editar", sem botão de sair.
- **Restrito:** o quadro não tem alças de arraste nem atalhos de criação, e o detalhe não tem editar nem arquivar.

## 9. Testes

Jest em ambiente node, SQLite em memória, nomes em pt-BR. Novas suítes:

- utilitários de busca, arquivo e rotas;
- filtro OU/OU/E;
- emissão, hash e revogação de links;
- validação de token: formato, revogado, expirado, restrito sem escopo e último acesso;
- esquemas de link;
- leitura com restrição: quadro, detalhe, arquivadas, busca e anexos;
- tokens de API;
- autenticação e contrato de erros da API, incluindo o catálogo inteiro sem token;
- operações da API e sincronismo com a interface;
- Server Actions com link completo, restrito, revogado e forjado, mais as ações exclusivas do administrador;
- páginas renderizadas em HTML e downloads;
- migração 0001 sobre banco da rodada anterior;
- movimentos por posição.

O servidor não foi iniciado nesta rodada, por decisão de escopo. A validação foi feita por testes e build.

## 10. Limitações

- Sem HTTPS, link e token trafegam em texto claro na rede local. O token do link também fica no histórico do navegador e nos registros de acesso do servidor. Para uso fora desta máquina, use um proxy TLS ou mantenha `HOST=127.0.0.1`.
- Quem tem o link acessa sem senha. A proteção é o segredo do link, sua revogação e a validade opcional.
- Não há limite de requisições nem auditoria por requisição. Há último acesso do link e último uso do token.
- Status e faixa de prioridade no escopo do link são respeitados na leitura, mas a interface ainda não oferece esses filtros.
- Anexos: só leitura e download; envio e endpoints de anexos na API ficam para a rodada de anexos. O envio e a remoção pela interface chegaram na rodada 4 (`docs/decisoes-tecnicas-anexos-personalizacao-lembretes.md`); os endpoints na API continuam fora.
- Status e tag no escopo de um link ativo ou expirado não podem ser excluídos. Para liberar, revogue o link.
- O smoke em navegador da rodada 2 não foi reexecutado.
