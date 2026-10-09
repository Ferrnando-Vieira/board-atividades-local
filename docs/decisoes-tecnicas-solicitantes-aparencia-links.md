# Decisões técnicas — solicitantes configuráveis e aparência por link (rodada 8)

Escopo: instalação limpa (sem carga inicial de atividades), solicitante padrão do board definido na configuração inicial, solicitante padrão por tag e aparência própria para links nomeados. Migrações 0007, 0008 e 0009.

## 1. Instalação limpa

- `npm run inicializar` cria só o board, os quatro status iniciais e o código de configuração. As migrações não carregam dados, e nenhum nome de pessoa, tag ou atividade fica gravado no código.
- O antigo importador de atividades saiu do projeto, junto com as tabelas dele (retiradas da migração 0000). O migrador do Drizzle só compara a data de cada migração, então bancos que já tinham essas tabelas seguem funcionando; elas apenas deixam de ser usadas.

## 2. Solicitante padrão do board (0007)

- `solicitantes.padrao` marca o padrão, com no máximo um por board (índice único parcial `WHERE padrao = 1`). Fica no banco porque cada instalação define o seu.
- `/configuracao-inicial` pede o nome e grava o padrão na mesma transação que cria o administrador e consome o código. Depois, a página **Solicitantes** (só o proprietário) troca o padrão; o anterior continua cadastrado.
- A 0007 marca, em bancos existentes, o solicitante mais antigo de cada board: nas versões anteriores ele nascia junto com o board e era o padrão. Assim a regra continua igual sem gravar nenhum nome na migração.
- Sem padrão definido, atividade sem solicitante é recusada com `solicitante-obrigatorio` (formulário, API e MCP).

## 3. Solicitante padrão por tag (0008)

- `tags.solicitante_padrao_id` (anulável, `ON DELETE SET NULL`) liga a tag a um solicitante. Nenhuma tag nasce com padrão: quem define é o usuário, na tela **Tags** ou por `POST`/`PATCH /tags` com `solicitantePadrao`.
- Ordem de decisão para uma atividade gravada com o solicitante em branco: o padrão da **primeira tag vinculada** que tiver um; senão o padrão do board; senão erro.
- "Primeira vinculada": na criação, a ordem em que as tags chegam (a ordem de inclusão no formulário ou de `tags[]` na API). Na edição, as tags que a atividade já tinha vêm antes das novas, na ordem do vínculo (`atividades_tags` por `criado_em` e `rowid`; cada gravação insere numa só instrução, que preserva a ordem). Por isso a ordem alfabética do formulário de edição não muda o resultado.
- Mudar o padrão de uma tag não altera atividades já gravadas: vale para as próximas gravações sem solicitante.
- No formulário de atividade nova, o campo Solicitante mostra a sugestão pela mesma regra (`sugerirSolicitante`) e a acompanha conforme as tags são adicionadas, até a pessoa digitar outro nome.

## 4. Aparência própria por link (0009)

- `aparencias_link` tem as mesmas colunas e CHECKs de `fundos_board`, montadas pelos mesmos construtores (`colunasAparencia` e `restricoesAparencia`), com chave `link_id` e `ON DELETE CASCADE`. O `drizzle-kit generate` confirmou que a refatoração não alterou `fundos_board`.
- `EscopoAparencia` (`board` ou `link`) decide onde a aparência é lida e gravada. O proprietário grava no board. Um link nomeado (completo ou restrito) grava no próprio escopo. O link padrão, público, só exibe a do board e não tem tela de aparência (404).
- Sem linha própria, o link exibe a aparência do board. A primeira alteração copia a do board e aplica a mudança por cima, para que mudar só o fundo não troque as cores. **Voltar à aparência do board** apaga a linha própria.
- As Server Actions de aparência aceitam a credencial do link (`exigirAcessoAparencia`): sem credencial, exigem a sessão administrativa e alteram o board; com credencial de link nomeado, alteram só aquele link; com a do link padrão, voltam ao quadro sem gravar. A alteração de um link revalida só a resposta dele, sem avisar as outras abas do board.
- Imagens de fundo: o mesmo arquivo pode ser usado pelo board e por links que copiaram a aparência. Um arquivo só sai do disco quando nenhuma linha (de `fundos_board` ou de `aparencias_link`) o referencia. A rota `/compartilhado/<token>/fundo` serve a imagem da aparência que o link exibe.
- Ficam no board, iguais para todos: as cores por coluna (Status) e as cores das tags.

## 5. Limitações

- Revogar um link mantém a aparência dele no banco, sem uso; a imagem própria fica em disco até o link ser apagado do banco e outra alteração descartá-la.
- A aparência de um link vale para todos que usam aquele mesmo link, porque o link é a identidade de quem entra.
