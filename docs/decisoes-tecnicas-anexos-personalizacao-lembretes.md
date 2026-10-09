# Decisões técnicas — anexos privados, fundo do board e lembretes (rodada 4)

Data: 01/10/2026. Escopo: envio, listagem, download e remoção de anexos privados; personalização do fundo do board; lembretes com notificações locais. Tudo usa a mesma camada de domínio, o mesmo SQLite e a mesma autorização das rodadas anteriores (`docs/decisoes-tecnicas.md`, `docs/decisoes-tecnicas-kanban.md` e `docs/decisoes-tecnicas-compartilhamento-api.md`), que continuam valendo.

## 1. Migração 0002

| Mudança                                                                                       | Motivo                                                                      |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `boards.fundo` (texto, padrão `padrao`, CHECK com as chaves do catálogo de fundos)            | Guardar só a chave do fundo escolhido, nunca CSS ou URL                     |
| `atividades.lembrete_dispensado_em` (CHECK de instante UTC e de coerência com disparo)        | Marcar como dispensado o aviso disparado, para não reaparecer ao recarregar |
| Índice parcial `atividades_lembretes_a_dispensar` (`situacao = 'disparado'` e não dispensado) | Consulta da central de lembretes                                            |

- **Anexos sem mudança de esquema.** A tabela `anexos` da 0000 já tinha metadados, identificador interno com CHECK de formato, hash, tamanho positivo e remoção lógica (`removido_em`).
- **Lembretes reaproveitam as colunas da 0000** (`lembrete_em`, `lembrete_situacao`, `lembrete_disparado_em`): um lembrete por atividade, como a fundação previu.
- **SQL escrito à mão.** O `drizzle-kit generate` recriava `atividades` e `boards`. Como o migrador roda numa transação com `foreign_keys` ativo, o DROP apagaria em cascata as tags das atividades e esbarraria no RESTRICT de anexos, status e links. Por isso a 0002 só usa `ADD COLUMN` com CHECK de coluna, validado contra as linhas existentes, e `CREATE INDEX`. O snapshot gerado pelo drizzle-kit foi mantido, e um `generate` posterior responde "No schema changes".
- **Banco real.** `dados/board-atividades.sqlite` não foi aberto nem migrado. A 0001 e a 0002 continuam pendentes nele. Antes de usar esta versão, execute `npm run db:migrar`.
  - A cadeia 0000 → 0002 foi validada em banco limpo (memória e arquivo temporário, com `integrity_check`).
  - Também foi validada numa fixture da rodada 3 (0000 + 0001 com board, atividades, tags, anexo, link com escopo, token e um lembrete histórico `disparado` sem momento de disparo). Todas as linhas foram preservadas, `foreign_key_check` ficou vazio e reaplicar não muda nada.

## 2. Anexos privados

**Armazenamento**

- Os bytes ficam em `DIRETORIO_ANEXOS`, que a configuração recusa dentro de `public/`.
- O nome em disco é um identificador de 24 bytes aleatórios em base64url (32 caracteres), no mesmo formato do CHECK. A criação é exclusiva (`wx`, permissão `0600`) e termina com `fsync`, então um anexo nunca sobrescreve outro.
- O nome original é só metadado. Dele ficam o último segmento do caminho, em NFC, sem caracteres de controle nem marcas de direção (que escondem a extensão real), sem pontos e espaços nas pontas e com no máximo 255 caracteres; nome maior é recusado, sem corte.

**Limites** (`config/anexos.ts`)

- 10 MiB por arquivo e 20 anexos ativos por atividade.
- O `next.config.ts` libera nas Server Actions 10 MiB mais 256 KiB de margem para o multipart. Um teste confere que os dois valores estão alinhados.
- A tela confere o tamanho antes do envio. A validação que vale é a do servidor.

**Tipos**

- O catálogo é fechado por extensão: PDF, PNG, JPG/JPEG, GIF, WebP, TXT, CSV, MD, DOCX, XLSX, PPTX, ODT, ODS, ZIP, DOC e XLS.
- Os primeiros bytes precisam bater com a extensão (assinatura). Texto só precisa não ter byte nulo, porque o CSV do Excel nem sempre é UTF-8.
- O tipo gravado sai do catálogo, nunca do que o navegador declara. HTML, SVG, scripts e executáveis ficam de fora, inclusive com dupla extensão (`nota.pdf.exe`) ou com extensão trocada (executável renomeado para `.pdf`).

**Consistência entre arquivo e banco**

1. Valida o arquivo e confere o destino: atividade no escopo, ativa e abaixo do limite.
2. Grava o arquivo.
3. Numa transação `IMMEDIATE`, confere o destino de novo e insere o metadado.
4. Se a transação falhar, o arquivo recém-gravado é apagado. Há teste com falha simulada por trigger.

- **Remoção.** Grava `removido_em` na transação e só depois apaga o arquivo. Se o arquivo não puder ser apagado na hora, a operação do usuário não é desfeita.
- **Sobras.** Sobram arquivos só se o processo cair entre a gravação e o commit, ou se um arquivo não puder ser apagado. `npm run anexos:limpar` (`reconciliarArquivosAnexos`) remove arquivos sem anexo ativo com mais de 10 minutos. Arquivos recentes, de um envio em andamento, e nomes fora do formato de identificador ficam intactos.
- **Ordem das recusas.** Atividade arquivada tem anexos só para leitura (409 `atividade-arquivada`). Atividade fora do escopo responde 404 antes de qualquer outra regra, sem revelar se existe ou está arquivada.

**Autorização (sempre no servidor)**

| Acesso                     | Listar e baixar                   | Enviar e remover                                                            |
| -------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| Proprietário (sessão)      | Sim                               | Sim                                                                         |
| Link completo              | Sim (o escopo é o board inteiro)  | Sim: é a capacidade de gestão que esse link já tinha (`exigirAcessoGestao`) |
| Link restrito              | Só anexos de atividades do filtro | Não: volta ao quadro somente leitura, sem gravar                            |
| Token inválido ou revogado | 404 no download                   | Redirecionamento para `/compartilhado`, sem gravar                          |

- **API.** Esta rodada não expõe anexos na API. As permissões `anexos:ler` e `anexos:escrever` continuam reservadas e não são oferecidas, então nenhum token ganhou acesso novo.

**Download**

- `application/octet-stream` com `Content-Disposition: attachment` (RFC 6266, nome em UTF-8).
- `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` e `Cache-Control: private, no-store` vão na própria resposta.
- Nenhum cabeçalho leva caminho físico nem o identificador interno. Anexo inexistente, removido, fora do escopo ou sem arquivo recebe a mesma resposta 404.

## 3. Fundo do board

- **Catálogo fechado** (`config/fundosBoard.ts`): padrão do tema, 5 cores (Areia, Céu, Lavanda, Menta, Névoa) e 4 gradientes (Amanhecer, Oceano, Campo, Aurora).
  - O banco guarda só a chave, com CHECK, e um teste confere que o catálogo e o CHECK da 0002 têm as mesmas chaves.
  - O estilo é montado a partir das cores do catálogo, em hexadecimal fixo. Não há CSS, URL nem recurso remoto vindo do cliente.
  - Incluir um fundo exige nova migração, como já acontece com as permissões da API.
- **Sem imagem.** Nem o esquema nem o projeto previam imagem de fundo, e uma imagem enviada criaria outra superfície de arquivo servido para exibição. Fica como limitação.
- **Contraste verificado por teste.** O teste calcula a razão WCAG para `texto`, `texto-suave` e `primaria` (lidos de `app/globals.css`) sobre cada cor e sobre a cor efetiva das colunas (`bg-borda/40` sobre o fundo). Todas ficam em 4,5:1 ou mais.
  - Cabeçalho, cartões, formulários e diálogos continuam sobre a superfície do tema.
  - O padrão não gera estilo e mantém `bg-fundo`, o que respeita o modo de alto contraste do sistema.
- **Quem altera.** Só o proprietário, na tela **Aparência** (`/aparencia`). A Server Action exige a sessão e ignora credencial de link.
- **Quem vê.** O fundo efetivo vale no painel e nos links completo e restrito, que não veem a tela de aparência.
- **Sem controle de versão.** É um valor único, escolhido inteiro e só pelo proprietário: a última escolha vale. A versão do board não muda, para não conflitar com nome e fuso.

## 4. Lembretes e notificações locais

| Situação gravada | Na tela                       | Pode                                                           |
| ---------------- | ----------------------------- | -------------------------------------------------------------- |
| `pendente`       | ativo                         | remarcar, desativar, excluir                                   |
| `cancelado`      | desativado                    | remarcar, reativar (só se o horário ainda for futuro), excluir |
| `disparado`      | disparado; depois, dispensado | remarcar (vira outro aviso), excluir                           |

**Regras**

- Data e hora são informadas no fuso do board e gravadas como instante UTC.
- Data ou hora inválida (`2026-02-30`, `24:00`) é recusada pelo Zod no campo certo. Horário no passado, inclusive o próprio minuto atual, recebe 400 `lembrete-no-passado`.
- Reativar um lembrete vencido dá 409 `lembrete-vencido`: o usuário remarca, em vez de receber um alarme atrasado. Desativar um lembrete já disparado dá 409 `lembrete-ja-disparado`.
- Criar, remarcar, ativar, desativar e excluir são edições da atividade: exigem a `versaoEsperada`, avançam a versão e recusam atividade arquivada.
- Disparar e dispensar mudam só o estado do aviso: a versão e o `atualizado_em` ficam iguais, para não invalidar um formulário aberto.

**Lembretes vencidos e atividades arquivadas**

- Um lembrete pendente cujo horário passou com o board fechado dispara na próxima verificação, marcado como **Atrasado** (tolerância de 2 minutos).
- O detalhe explica cada caso: ativo vencido, desativado vencido, histórico já disparado sem momento de disparo.
- Atividade arquivada não dispara. O lembrete volta a valer quando ela é restaurada.

**Disparo sem duplicidade**

1. **No servidor.** A troca de `pendente` para `disparado` é um UPDATE condicionado à situação e ao instante, numa transação `IMMEDIATE`. Só a sincronização que encontra a linha ainda pendente recebe o aviso como novo; há teste com duas conexões no mesmo arquivo.
2. **No navegador.** A notificação usa `tag` = `atividade@instante`, e as últimas 200 chaves exibidas ficam no `localStorage`. Remarcar gera outra chave. Sem `localStorage` (modo privado ou bloqueio), vale só a deduplicação do servidor.

**Persistência ao recarregar**

- A central lista, a partir do servidor, os avisos disparados e não dispensados.
- **Dispensar** grava `lembrete_dispensado_em`. É idempotente e só vale para o mesmo instante, então não alcança um lembrete remarcado.
- Os lembretes históricos (`disparado` sem momento de disparo) não aparecem na central.

**Notification API (progressiva)**

- A permissão só é pedida no clique em **Ativar notificações do navegador**.
- A central mostra o estado de cada caso, com texto próprio: API indisponível, fora de contexto seguro, não solicitada, concedida ou negada.
- Se o construtor for recusado, como no Chrome do Android sem service worker, o aviso fica só na central.
- Não há nuvem, push, túnel, service worker nem serviço remoto.
- A central sincroniza a cada 30 segundos e ao voltar para a aba, só com a página aberta.

**Autorização**

- **Proprietário.** Só a sessão administrativa cria, remarca, ativa, desativa, exclui, sincroniza (que é o que dispara) e dispensa. Credencial de link é ignorada e redireciona para `/entrar`, sem gravar nem disparar.
- **Link completo: não gerencia lembretes, por decisão desta rodada.** As capacidades autorizadas desse link são atividades, movimento, arquivamento, status, tags e solicitantes. Lembrete não estava entre elas, e o aviso é pessoal do proprietário: chega no navegador dele. Ampliar isso seria conceder permissão implicitamente.
- **Links completo e restrito** não veem lembretes: nem a central, nem a página `/lembretes`, nem a situação do lembrete no detalhe da atividade (alterado em 06/10/2026; antes os links viam esse resumo). O restrito não tem nenhuma rota que liste lembretes ou cards fora do filtro.
- **API.** O contrato não mudou: `lembreteEm` e `lembreteSituacao` continuam no JSON da atividade, só para leitura. Não há endpoint de lembretes.

## 5. Interface

- **Detalhe da atividade**
  - Só o proprietário vê o resumo do lembrete e a orientação; para os links o item não aparece.
  - O proprietário, com a atividade ativa, vê a seção **Lembrete**: data, hora, Salvar/Remarcar, Desativar/Reativar e Excluir lembrete.
  - **Anexos** lista nome, tamanho e data, com download. Quem tem gestão vê o campo de arquivo (com `accept` e a dica dos limites) e a remoção com confirmação nativa (`DialogoConfirmacao`). Em atividade arquivada, aparece um aviso no lugar do envio.
- **Central no cabeçalho** (só o proprietário)
  - Botão **Lembretes** com contagem e um painel com a lista, o selo Atrasado e o botão Dispensar.
  - Mostra o estado e o botão da permissão do navegador e a limitação de funcionamento.
  - Novos avisos abrem o painel e são anunciados em `aria-live`. Esc fecha o painel e devolve o foco ao botão.
- **Aparência** entra na navegação só para o proprietário.
- **Celular primeiro:** grades de uma coluna que viram duas ou três, alvos de no mínimo 44 px e painel limitado à largura da tela. Não foi adicionada dependência; os componentes existentes foram reaproveitados (`Botao`, `CampoFormulario`, `MensagemAlerta`, `DialogoConfirmacao`, `Cartao`).

## 6. Testes

Jest em ambiente node, nomes em pt-BR, SQLite em memória ou em arquivo temporário, e diretórios temporários para os anexos, apagados ao fim de cada suíte. São 11 suítes novas, com 311 casos:

- `tests/servidor/anexos/validacaoAnexos.test.ts` (51): nomes hostis, caminhos, controles, marcas de direção, limites exato e +1 byte, catálogo, extensões proibidas e assinaturas.
- `tests/servidor/anexos/anexosServico.test.ts` (21):
  - envio, listagem e download;
  - nome interno e caminho hostil;
  - sem sobrescrita;
  - atividade inexistente, arquivada ou fora do escopo;
  - limite por atividade;
  - rollback por trigger;
  - remoção;
  - reconciliação de órfãos.
- `tests/servidor/web/acoesAnexos.test.ts` (12): proprietário, link completo, restrito (envio e remoção negados), revogado, forjado, sem sessão, arquivo ausente, grande ou de tipo proibido.
- `tests/servidor/lembretes/lembretesServico.test.ts` (32):
  - CRUD e versão;
  - datas inválidas e no passado;
  - vencidos e arquivadas;
  - disparo único, também com duas conexões;
  - atraso;
  - históricos (já disparados, sem momento de disparo);
  - dispensa idempotente.
- `tests/servidor/web/acoesProprietario.test.ts` (18): fundo (válido e 7 entradas maliciosas) e lembretes, com as mutações negadas aos links completo e restrito, sincronização e dispensa sem sessão, e deduplicação ponta a ponta.
- `tests/servidor/web/paginasAnexosLembretes.test.ts` (11):
  - HTML de cada acesso;
  - nada fora do filtro no link restrito;
  - cabeçalhos do download sem caminho;
  - 404 fora do escopo e após a remoção;
  - fundo aplicado no link;
  - aparência exige sessão.
- `tests/screens/lembretes/notificacoesNavegador.test.ts` (26): API indisponível, contexto inseguro, permissão negada, pedido com falha, construtor recusado, `tag` e registro local (limite, JSON corrompido, armazenamento bloqueado).
- `tests/screens/atividades/descricaoLembrete.test.ts` (14), `tests/config/fundosBoard.test.ts` (104: contraste, formato, CHECK e limite do `next.config`), `tests/servidor/board/fundoBoard.test.ts` (12) e `tests/servidor/banco/migracao0002.test.ts` (10).

A suíte existente `paginasCompartilhadas.test.ts` só ganhou `useRouter` na simulação de `next/navigation`, porque a central de lembretes passou a ser renderizada no cabeçalho do proprietário. Nenhuma asserção foi alterada.

## 7. Como usar

```bash
npm run db:migrar      # aplica 0001 e 0002 no banco real antes de usar esta versão
npm run anexos:limpar  # opcional: remove arquivos órfãos do diretório de anexos
```

Para receber notificações do sistema, abra o board em `http://127.0.0.1:<porta>` ou `http://localhost:<porta>` (contexto seguro), ou por HTTPS, e clique em **Lembretes → Ativar notificações do navegador**. Pelo IP da LAN em HTTP, o navegador não oferece a Notification API: os avisos aparecem só na central.

## 8. Limitações

- **Notificações dependem da aplicação aberta.**
  - Só chegam com o board aberto no navegador do proprietário. Não há push nem service worker, e o aviso pode chegar até cerca de 30 segundos depois do horário.
  - Com o board fechado, o aviso aparece como atrasado na próxima abertura.
  - A notificação do sistema também exige contexto seguro (HTTPS ou localhost) e permissão concedida.
  - Um navegador em segundo plano pode espaçar os temporizadores; a verificação é refeita ao voltar para a aba.
- **Um lembrete por atividade**, conforme o modelo da fundação.
- **Sem imagem de fundo**, só o padrão, cores e gradientes do catálogo.
- **Sem endpoints de anexos ou lembretes na API.** As permissões `anexos:*` continuam reservadas.
- **Validação de tipo.** Confere extensão e assinatura, não o conteúdo interno: um DOCX com macro ou um ZIP com qualquer arquivo dentro são aceitos. O download é sempre um anexo, mas não há antivírus.
- **Recursos do servidor.**
  - O limite de corpo das Server Actions (10 MiB + 256 KiB) vale para todas as ações.
  - O arquivo enviado é lido inteiro na memória (até 10 MiB).
  - Não há cota total de disco.
- **Validação em navegador real.** Não houve, porque nenhum servidor foi iniciado, por decisão de escopo. As telas foram verificadas por renderização no servidor (React DOM) e a Notification API, por simulação. Arraste por toque continua fora do escopo.
- **Banco real.** Precisa de `npm run db:migrar` antes de usar esta versão.
