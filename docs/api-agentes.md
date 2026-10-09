# API local para agentes (Kiro, Claude Code, Cowork)

A API HTTP é a única forma suportada de integrar agentes ao board. Ela usa os mesmos esquemas Zod, serviços e transações da interface, então o que um agente grava aparece no quadro na hora, e vice-versa. **Não edite o arquivo SQLite diretamente**: isso pula as validações, a gravação interna da ordem em duas fases e a concorrência por versão, e pode deixar o board inconsistente.

## 1. Acesso

- **Endereço base:** `<URL_BASE_LAN>/api/v1` (por exemplo, `http://127.0.0.1:3000/api/v1`). A tela **Integrações** mostra o endereço exato.
- **Token:** gerado pelo proprietário em **Integrações → Gerar token**. Ele começa com `bat_` e só aparece uma vez; o banco guarda apenas o SHA-256. Revogar vale na requisição seguinte.
- **Cabeçalho:** `Authorization: Bearer <token>` em todas as requisições, inclusive em `GET /api/v1`.
- **Corpo:** JSON (`Content-Type: application/json`), até 256 KiB. O envio de anexos é a exceção: `multipart/form-data`, até 25 MiB de arquivos (seção 4).
- Links de compartilhamento não servem como token de API, e tokens de API não abrem links.

### Permissões

| Permissão             | Libera                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `board:ler`           | `GET /board`, `GET /status`, `GET /tags`, `GET /solicitantes`                                                                                                                                        |
| `board:escrever`      | criar, renomear, mover e excluir status; criar, renomear e excluir tags; cadastrar solicitantes e definir o solicitante padrão                                                                       |
| `atividades:ler`      | listar, buscar e detalhar atividades (ativas e arquivadas) e ler o histórico delas; listar e ler lembretes avulsos                                                                                   |
| `atividades:escrever` | criar, editar, priorizar, mover, arquivar e desarquivar atividades; definir, desativar, reativar e excluir o lembrete da atividade; criar, remarcar, desativar, reativar e excluir lembretes avulsos |
| `anexos:ler`          | listar e ler os anexos das atividades                                                                                                                                                                |
| `anexos:escrever`     | enviar e remover anexos, inclusive as imagens usadas na descrição                                                                                                                                    |

Os lembretes (da atividade e avulsos) não têm permissão própria: usam `atividades:ler` e `atividades:escrever`, para que os tokens já emitidos continuem servindo. Quem pode editar atividades também pode criar e apagar lembretes. Os anexos têm permissões próprias: tokens emitidos antes delas precisam ser gerados de novo para enviar ou ler arquivos.

`GET /api/v1` aceita qualquer token válido e devolve as permissões do próprio token e o catálogo de endpoints. Criar ou editar uma atividade com tag ou solicitante novos também os cadastra, exatamente como o formulário da interface.

## 2. Formato das respostas

Sucesso: `{ "dados": ... }`, com `200` (ou `201` na criação, com o cabeçalho `Location`). Erro:

```json
{
  "erro": {
    "codigo": "dados-invalidos",
    "mensagem": "Os dados enviados são inválidos. Veja os campos indicados.",
    "campos": { "titulo": ["Informe o título da atividade."] },
    "gerais": ["Chave inválida: \"dono\""]
  }
}
```

| Status | Quando                                                                                                                               | Códigos frequentes                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | JSON ou multipart malformado, tipo errado, campo desconhecido, regra do formulário, parâmetro desconhecido, arquivo fora do catálogo | `json-invalido`, `multipart-invalido`, `dados-invalidos`, `parametro-desconhecido`, `destino-obrigatorio`, `lembrete-no-passado`, `arquivo-ausente`, `conteudo-incompativel` |
| 401    | token ausente, inválido, expirado ou revogado (`WWW-Authenticate: Bearer`)                                                           | `token-ausente`, `token-invalido`                                                                                                                                            |
| 403    | token sem a permissão do endpoint                                                                                                    | `permissao-insuficiente`                                                                                                                                                     |
| 404    | recurso ou endpoint inexistente                                                                                                      | `atividade-inexistente`, `anexo-inexistente`, `status-inexistente`, `lembrete-avulso-inexistente`, `rota-inexistente`                                                        |
| 405    | método não implementado (`Allow` lista os aceitos)                                                                                   | `metodo-nao-permitido`                                                                                                                                                       |
| 409    | concorrência ou regra de estado                                                                                                      | `conflito-de-versao`, `atividade-arquivada`, `nome-tag-repetido`, `tag-em-compartilhamento`, `lembrete-ja-disparado`, `lembrete-vencido`, `limite-de-anexos`                 |
| 413    | corpo JSON acima de 256 KiB ou envio de anexos acima de 25 MiB                                                                       | `corpo-grande-demais`, `envio-grande-demais`, `arquivo-grande-demais`                                                                                                        |
| 415    | corpo sem `application/json` (ou sem `multipart/form-data` no envio de anexos), tipo de arquivo fora do catálogo                     | `tipo-conteudo-nao-suportado`, `tipo-arquivo-nao-permitido`                                                                                                                  |
| 503    | banco ausente ou instalação incompleta                                                                                               | `instalacao-incompleta`                                                                                                                                                      |

As mensagens de validação são as mesmas da interface, em pt-BR. Toda resposta tem `Cache-Control: no-store` e passa por um esquema de saída antes de sair.

## 3. Concorrência

Toda alteração de atividade (inclusive do lembrete dela), de status e de lembrete avulso exige `versaoEsperada`, a versão lida no último `GET`. Se outra operação gravou antes, a resposta é `409 conflito-de-versao` e nada muda: leia de novo e repita. Editar, trocar de status, arquivar, desarquivar e alterar o lembrete avançam a versão da atividade, assim como renomear ou excluir uma tag dela; enviar ou remover anexos não avança. Em lembretes, toda alteração (inclusive desativar e reativar) avança a versão. Tags usam o `nomeAtual` como condição.

## 4. Endpoints

`{id}` é um inteiro positivo; outro formato responde `404`.

| Método | Caminho                                      | Permissão             | Corpo / consulta                                                                                                                                          |
| ------ | -------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1`                                    | qualquer token        | —                                                                                                                                                         |
| GET    | `/api/v1/board`                              | `board:ler`           | —                                                                                                                                                         |
| GET    | `/api/v1/atividades`                         | `atividades:ler`      | `?status=<id>&tag=<nome>&solicitante=<nome>&busca=<texto>&situacao=ativas\|arquivadas\|todas`                                                             |
| POST   | `/api/v1/atividades`                         | `atividades:escrever` | `titulo` + opcionais `descricao`, `prioridade` (0–9), `statusId`, `solicitante`, `tags[]`, `prazoData`, `prazoHora`, `concluidaEmData`, `concluidaEmHora` |
| GET    | `/api/v1/atividades/{id}`                    | `atividades:ler`      | —                                                                                                                                                         |
| PATCH  | `/api/v1/atividades/{id}`                    | `atividades:escrever` | `versaoEsperada` + qualquer campo do POST; `null` limpa campo opcional                                                                                    |
| POST   | `/api/v1/atividades/{id}/mover`              | `atividades:escrever` | `versaoEsperada`, `statusId` (opcional: a coluna atual), `posicao` (aceita, sem efeito na ordem automática)                                               |
| POST   | `/api/v1/atividades/{id}/arquivar`           | `atividades:escrever` | `versaoEsperada`                                                                                                                                          |
| POST   | `/api/v1/atividades/{id}/desarquivar`        | `atividades:escrever` | `versaoEsperada`                                                                                                                                          |
| GET    | `/api/v1/atividades/{id}/historico`          | `atividades:ler`      | —                                                                                                                                                         |
| GET    | `/api/v1/atividades/{id}/anexos`             | `anexos:ler`          | —                                                                                                                                                         |
| POST   | `/api/v1/atividades/{id}/anexos`             | `anexos:escrever`     | `multipart/form-data` com 1 a 10 campos `arquivo`                                                                                                         |
| GET    | `/api/v1/atividades/{id}/anexos/{anexoId}`   | `anexos:ler`          | — (devolve o arquivo)                                                                                                                                     |
| DELETE | `/api/v1/atividades/{id}/anexos/{anexoId}`   | `anexos:escrever`     | —                                                                                                                                                         |
| PUT    | `/api/v1/atividades/{id}/lembrete`           | `atividades:escrever` | `versaoEsperada`, `lembreteData`, `lembreteHora`                                                                                                          |
| POST   | `/api/v1/atividades/{id}/lembrete/desativar` | `atividades:escrever` | `versaoEsperada`                                                                                                                                          |
| POST   | `/api/v1/atividades/{id}/lembrete/reativar`  | `atividades:escrever` | `versaoEsperada`                                                                                                                                          |
| DELETE | `/api/v1/atividades/{id}/lembrete`           | `atividades:escrever` | `?versaoEsperada=<n>`                                                                                                                                     |
| GET    | `/api/v1/lembretes`                          | `atividades:ler`      | `?situacao=pendente\|disparado\|cancelado` (sem filtro, todos)                                                                                            |
| POST   | `/api/v1/lembretes`                          | `atividades:escrever` | `titulo`, `lembreteData`, `lembreteHora` + opcional `observacao`                                                                                          |
| GET    | `/api/v1/lembretes/{id}`                     | `atividades:ler`      | —                                                                                                                                                         |
| PATCH  | `/api/v1/lembretes/{id}`                     | `atividades:escrever` | `versaoEsperada` + `titulo`, `observacao` (`null` limpa), `lembreteData` e/ou `lembreteHora`                                                              |
| POST   | `/api/v1/lembretes/{id}/desativar`           | `atividades:escrever` | `versaoEsperada`                                                                                                                                          |
| POST   | `/api/v1/lembretes/{id}/reativar`            | `atividades:escrever` | `versaoEsperada`                                                                                                                                          |
| DELETE | `/api/v1/lembretes/{id}`                     | `atividades:escrever` | `?versaoEsperada=<n>`                                                                                                                                     |
| GET    | `/api/v1/status`                             | `board:ler`           | —                                                                                                                                                         |
| POST   | `/api/v1/status`                             | `board:escrever`      | `nome` + opcionais `finalizaAtividade`, `corTitulo`, `corColuna` (`#rrggbb`; `null` = cores globais da Aparência)                                         |
| PATCH  | `/api/v1/status/{id}`                        | `board:escrever`      | `versaoEsperada` + `nome`, `finalizaAtividade`, `corTitulo` e/ou `corColuna`                                                                              |
| POST   | `/api/v1/status/{id}/mover`                  | `board:escrever`      | `posicao`                                                                                                                                                 |
| DELETE | `/api/v1/status/{id}`                        | `board:escrever`      | `?versaoEsperada=<n>&statusDestinoId=<id>` (destino obrigatório se houver atividades)                                                                     |
| GET    | `/api/v1/tags`                               | `board:ler`           | —                                                                                                                                                         |
| POST   | `/api/v1/tags`                               | `board:escrever`      | `nome` + opcionais `cor` (`#rrggbb`; `null` = chip neutro) e `solicitantePadrao`                                                                          |
| PATCH  | `/api/v1/tags/{id}`                          | `board:escrever`      | `nomeAtual` + `nome`, `cor` e/ou `solicitantePadrao` (`null` remove); trocar só cor ou solicitante não altera a versão das atividades                     |
| DELETE | `/api/v1/tags/{id}`                          | `board:escrever`      | `?nomeAtual=<nome>`                                                                                                                                       |
| GET    | `/api/v1/solicitantes`                       | `board:ler`           | —                                                                                                                                                         |
| POST   | `/api/v1/solicitantes`                       | `board:escrever`      | `nome` (`201` se novo; `200` com o existente se já houver)                                                                                                |
| PUT    | `/api/v1/solicitantes/padrao`                | `board:escrever`      | `nome` (nome novo é cadastrado)                                                                                                                           |

Regras que valem igual à interface:

- **A ordem na coluna é automática.** Prioridade crescente (0 é a mais alta), depois a data de criação (a mais antiga primeiro) e, no empate, o `id`. Nos status que concluem (como "Concluídos"), a ordem é a conclusão mais recente primeiro (data e hora), com a mesma regra no desempate. "Priorizar" é `PATCH` com `prioridade`, e a atividade muda de lugar na hora; a interface e a API usam a mesma regra.
- **Posição** é o índice entre as ativas da coluna nessa ordem (0 = topo), o número devolvido em `posicao`. Em `mover`, `posicao` continua aceita por compatibilidade, mas não altera a ordem: use `mover` para trocar de status.
- Trocar `statusId` pelo `PATCH` leva a atividade à nova coluna, na posição da ordem automática. Em status que conclui, sem data informada, a conclusão recebe o momento atual no fuso do board; nos demais, é removida.
- Filtros: valores repetidos do mesmo parâmetro combinam com OU (`tag=A&tag=B`); parâmetros diferentes, com E. Nomes de tag e solicitante ignoram acento e maiúsculas. Nome sem cadastro não corresponde a nada (a lista volta vazia). `busca` procura todas as palavras no título, descrição, solicitante e tags.
- **Solicitante padrão.** `solicitante` omitido, nulo ou em branco grava, nesta ordem: o `solicitantePadrao` da primeira tag da atividade que tiver um (na criação, a ordem de `tags[]`; na edição, as tags já vinculadas vêm antes das novas) ou o solicitante padrão do board, definido na configuração inicial e alterável na página **Solicitantes** (`GET /solicitantes` o marca com `"padrao": true`). Sem nenhum dos dois, a atividade é recusada (`400 solicitante-obrigatorio`). O padrão de cada tag é definido na página **Tags** ou por `POST`/`PATCH /tags` com `solicitantePadrao` (`null` remove); mudá-lo não altera atividades já gravadas.
- Arquivar não apaga nada. Atividade arquivada não é editada nem movida até ser desarquivada, e volta ao seu status na posição da ordem automática.
- **`descricao` é Markdown** (GFM): negrito, itálico, listas, listas de tarefas, `código`, blocos de código com três crases (com a linguagem, como ` ```ts `), tabelas e links aparecem formatados no board, e cada bloco de código ganha o botão **Copiar**. Uma quebra de linha simples quebra a linha. HTML aparece como texto.
- **Imagem na descrição.** A imagem só aparece se for um anexo de imagem (PNG, JPG, GIF ou WebP) da própria atividade, citado como `![nome](anexo:<id>)`. Envie o arquivo com `POST /atividades/{id}/anexos` e coloque na `descricao` o campo `markdown` devolvido para cada imagem. Enviar anexo não muda a versão da atividade, então o `PATCH` seguinte usa a versão já lida.
- **Anexos.** O envio usa o catálogo de tipos, a conferência de assinatura e os limites da tela: 10 MiB por arquivo, até 10 arquivos e 25 MiB por envio, 30 anexos por atividade; tudo ou nada. Atividade arquivada tem anexos só para leitura. `GET /atividades/{id}/anexos/{anexoId}` devolve o arquivo com o tipo gravado no envio, `Content-Disposition: attachment`, `nosniff` e CSP `sandbox`.
- **Histórico.** Toda alteração feita pela API entra no **Histórico de alterações** da atividade com o nome do token como autor (por isso vale dar a cada agente um token com nome próprio). Reordenar na mesma coluna e salvar sem mudar nada não geram registro. `GET /atividades/{id}/historico` devolve os 200 eventos mais recentes e o total.
- **Lembrete da atividade.** `PUT /atividades/{id}/lembrete` define ou remarca (volta a `pendente`), com data e hora futuras no fuso do board; `desativar`, `reativar` e `DELETE` seguem as regras dos lembretes avulsos abaixo. Todos devolvem a atividade, com `lembreteEm` e `lembreteSituacao` atualizados.
- **Lembretes avulsos** são os da página **Lembretes** (sem atividade). `lembreteData` (`AAAA-MM-DD`) e `lembreteHora` (`HH:MM`) valem no fuso do board e precisam ser **futuras** (`400 lembrete-no-passado`). O aviso aparece no navegador do proprietário, com o board aberto, no horário marcado; a API só grava, não dispara.
- `PATCH` em lembrete **remarca**, como na interface: o lembrete volta a `pendente` no horário resultante, e o que não foi enviado fica como está. Por isso, trocar só o título de um lembrete que já disparou falha com `lembrete-no-passado`: envie também uma nova data e hora.
- `desativar` leva a `cancelado` (não dispara); lembrete já disparado não pode ser desativado (`409 lembrete-ja-disparado`). `reativar` volta a `pendente` se o horário ainda for futuro; senão, `409 lembrete-vencido`: remarque com `PATCH`. Repetir `desativar` ou `reativar` em quem já está no estado pedido não altera nada.
- Excluir tag remove só a tag e os vínculos; tag ou status no escopo de um link de compartilhamento ativo não podem ser excluídos (`409`).

### Atividade devolvida

```json
{
  "id": 40,
  "titulo": "Conferir fretes",
  "descricao": null,
  "prioridade": 2,
  "versao": 3,
  "status": { "id": 1, "nome": "A Fazer", "finalizaAtividade": false },
  "posicao": 0,
  "solicitante": "Financeiro",
  "tags": [{ "id": 4, "nome": "Fiscal", "cor": "#bfdbfe" }],
  "prazoData": "2026-10-15",
  "prazoHora": "18:00",
  "concluidaEmData": null,
  "concluidaEmHora": null,
  "lembreteEm": null,
  "lembreteSituacao": null,
  "arquivada": false,
  "arquivadaEm": null,
  "criadoEm": "2026-10-01T20:10:00.000Z",
  "atualizadoEm": "2026-10-01T20:12:00.000Z"
}
```

Tags e status trazem as cores escolhidas na interface (`cor`, `corTitulo`, `corColuna`), ou `null` quando usam o padrão. Datas (`prazoData`, `concluidaEmData`) são `AAAA-MM-DD` no fuso do board, horas são `HH:MM`, e instantes (`criadoEm`, `arquivadaEm`, `lembreteEm`) são ISO 8601 em UTC.

### Lembrete avulso devolvido

```json
{
  "id": 4,
  "titulo": "Revisar checklist de publicação em staging",
  "observacao": null,
  "lembreteEm": "2026-10-06T16:28:00.000Z",
  "lembreteData": "2026-10-06",
  "lembreteHora": "13:28",
  "situacao": "pendente",
  "disparadoEm": null,
  "dispensadoEm": null,
  "versao": 1
}
```

`lembreteEm` é o instante em UTC (como nas atividades); `lembreteData` e `lembreteHora` trazem o mesmo momento no fuso do board, no mesmo formato em que são enviados. `situacao` é `pendente` (ativo), `disparado` (já avisado; `dispensadoEm` marca quando o proprietário dispensou o aviso) ou `cancelado` (desativado). A lista traz os pendentes por horário e, depois, os demais.

## 5. Exemplos

PowerShell (Windows PowerShell 5.1 ou PowerShell 7). O `charset=utf-8` no `-ContentType` é obrigatório no 5.1 para texto com acento: sem ele, o corpo vai em ISO-8859-1 e a API responde `400 json-invalido`.

```powershell
$base = 'http://127.0.0.1:3000/api/v1'
$cabecalhos = @{ Authorization = "Bearer $env:BOARD_TOKEN" }
$tipoJson = 'application/json; charset=utf-8'

Invoke-RestMethod "$base/atividades?tag=Faturas&situacao=ativas" -Headers $cabecalhos

$nova = @{ titulo = 'Conferir notas de serviço'; prioridade = 2; tags = @('Faturas') } | ConvertTo-Json
$criada = (Invoke-RestMethod "$base/atividades" -Method Post -Headers $cabecalhos -ContentType $tipoJson -Body $nova).dados

$mover = @{ versaoEsperada = $criada.versao; statusId = 2; posicao = 0 } | ConvertTo-Json
Invoke-RestMethod "$base/atividades/$($criada.id)/mover" -Method Post -Headers $cabecalhos -ContentType $tipoJson -Body $mover
```

curl (bash, WSL ou Git Bash):

```bash
curl -s "$BASE/atividades/40" -H "Authorization: Bearer $BOARD_TOKEN"
curl -s -X PATCH "$BASE/atividades/40" -H "Authorization: Bearer $BOARD_TOKEN" \
  -H 'Content-Type: application/json' -d '{"versaoEsperada": 3, "prioridade": 0}'
```

curl no PowerShell: chame `curl.exe`, porque `curl` é um apelido do `Invoke-WebRequest` no Windows PowerShell 5.1. Envie o JSON de um arquivo, já que o 5.1 remove as aspas de argumentos passados a programas externos:

```powershell
curl.exe -s "$base/atividades/40" -H "Authorization: Bearer $env:BOARD_TOKEN"
[IO.File]::WriteAllText("$PWD\corpo.json", '{"versaoEsperada": 3, "prioridade": 0}')
curl.exe -s -X PATCH "$base/atividades/40" -H "Authorization: Bearer $env:BOARD_TOKEN" -H 'Content-Type: application/json' --data-binary '@corpo.json'
Remove-Item corpo.json
```

Guarde o token numa variável de ambiente ou no cofre de segredos do agente, nunca no código nem em arquivos versionados. Para uma variável só da sessão atual: `$env:BOARD_TOKEN = Read-Host 'Token da API'`.

## 6. Servidor MCP

Para agentes que falam MCP (Model Context Protocol), como o Claude Code e o Kiro, o projeto traz um servidor por stdio que expõe esta API como ferramentas. Ele não abre o SQLite: cada ferramenta faz a requisição HTTP correspondente com o token configurado, então valem as mesmas permissões, validações e erros.

- **Iniciar:** `npm run mcp` (o agente costuma iniciar sozinho). O `.mcp.json` da raiz já registra o servidor `board-atividades` para o Claude Code aberto na pasta do projeto; a tela Integrações mostra a configuração com caminhos absolutos para outros clientes e o comando `claude mcp add --scope user`.
- **Configuração:** `BOARD_API_TOKEN` (obrigatório, gerado em Integrações) e `BOARD_API_URL` (padrão `http://127.0.0.1:<PORTA>/api/v1`), lidos do ambiente do processo ou do `.env.local` do projeto. Sem token, o servidor sobe e cada ferramenta responde com a orientação de configuração.
- **Ferramentas:** uma por endpoint da tabela da seção 4, com o mesmo esquema de entrada (mais `id` e `anexoId` quando o caminho os tem): `identificar_token`, `ler_board`, `listar_atividades`, `criar_atividade`, `ler_atividade`, `atualizar_atividade`, `mover_atividade`, `arquivar_atividade`, `desarquivar_atividade`, `ler_historico_atividade`, `listar_anexos`, `anexar_arquivos`, `ler_anexo`, `remover_anexo`, `definir_lembrete_atividade`, `desativar_lembrete_atividade`, `reativar_lembrete_atividade`, `excluir_lembrete_atividade`, `listar_lembretes`, `criar_lembrete`, `ler_lembrete`, `atualizar_lembrete`, `desativar_lembrete`, `reativar_lembrete`, `excluir_lembrete`, `listar_status`, `criar_status`, `atualizar_status`, `mover_status`, `excluir_status`, `listar_tags`, `criar_tag`, `editar_tag`, `excluir_tag`, `listar_solicitantes`, `registrar_solicitante` e `definir_solicitante_padrao`. As de leitura levam `readOnlyHint` e as exclusões, `destructiveHint`.
- **Anexos pelo MCP:** `anexar_arquivos` recebe caminhos **absolutos** de arquivos desta máquina; o servidor MCP lê cada arquivo (até 10 MiB) e o envia em multipart, sem o agente precisar codificar o conteúdo. `ler_anexo` devolve imagem PNG, JPG, GIF ou WebP como conteúdo de imagem do MCP (o modelo vê a imagem), TXT, CSV e MD como texto e os demais tipos só com tipo e tamanho. `mover_atividade` não aceita `posicao`, que não altera a ordem.
- **Resultados:** os `dados` da API em JSON (também em `structuredContent`). Erros da API, argumentos inválidos e board desligado voltam como resultado com `isError`, trazendo código, mensagem e campos para o agente corrigir e tentar de novo — por exemplo, ler de novo a atividade depois de `conflito-de-versao`.
- **Protocolo:** JSON-RPC 2.0 por linhas no stdin/stdout (versões `2025-11-25`, `2025-06-18`, `2025-03-26` e `2024-11-05`), com `initialize`, `ping`, `tools/list` e `tools/call`. Logs vão para o stderr.

## 7. Limitações

- Sem HTTPS, o token trafega em texto claro na rede local. Para acesso de outra máquina, use um proxy TLS na frente do board ou mantenha `HOST=127.0.0.1` e rode o agente na mesma máquina (README, seções 5 e 6).
- Não há limite de requisições; o token tem 256 bits aleatórios, então adivinhar não é viável, mas um token vazado vale até ser revogado ou expirar.
- O MCP envia qualquer arquivo local que o agente indicar, desde que o catálogo de tipos aceite: o conteúdo fica no board privado, mas é visto por quem tem link completo. Confira as chamadas de `anexar_arquivos` antes de aprovar.
- As listas não são paginadas; o volume esperado é de dezenas a poucas centenas de atividades.
