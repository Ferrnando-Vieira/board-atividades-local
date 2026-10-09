# Decisões técnicas — Kanban e gestão (rodada 2)

Data: 01/10/2026. Escopo: Kanban interativo e gestão de atividades, status, tags e solicitantes, com persistência imediata no SQLite e autorização no servidor. A fundação da rodada 1 (`docs/decisoes-tecnicas.md`) continua valendo; nenhuma migração nova foi necessária. Compartilhamento, API de agentes, anexos, plano de fundo e disparo de lembretes ficam para as próximas rodadas.

## 1. Camadas

| Camada            | Onde                                                                                                                      | Papel                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Esquemas Zod      | `servidor/atividades/esquemasAtividades.ts`, `servidor/board/esquemasStatus.ts`, `servidor/classificacao/esquemasTags.ts` | Únicos validadores de entrada. Não dependem de Next nem do banco, para serem reaproveitados pelas rotas da API externa da próxima rodada       |
| Serviços          | `atividadesServico.ts`, `statusServico.ts`, `tagsServico.ts`                                                              | Regras de negócio. Cada operação é uma transação `IMMEDIATE`: ou tudo é gravado, ou nada                                                       |
| Consultas         | `consultaQuadro.ts`, `consultasAtividades.ts`, `consultasClassificacao.ts`                                                | Modelos de leitura das telas, já no formato exibido                                                                                            |
| Server Actions    | `servidor/web/acoes/acoes{Atividades,Status,Tags}.ts`                                                                     | Sessão obrigatória → Zod → serviço → `revalidatePath('/', 'layout')`. Erros de negócio (4xx) voltam à tela; os demais seguem ao error boundary |
| Telas             | `screens/{board,atividades,arquivadas,status,tags}`                                                                       | `app/` só monta a página, exige a sessão e chama a tela                                                                                        |
| Lógica pura da UI | `screens/board/movimentosQuadro.ts`, `util/{ListaUtils,PrazoUtils,EsquemaUtils}.ts`                                       | Sem React; coberta por testes em ambiente node                                                                                                 |

Os nomes dos campos de formulário ficam em `config/camposFormulario.ts` e são iguais às chaves dos esquemas, então os erros por campo devolvidos pelo servidor caem no campo certo. Os textos de interface seguem o padrão `textos*.ts` por tela, sem i18n (o projeto não usa i18n).

## 2. Autorização

- Toda página chama `exigirSessaoAdministrativa()` antes de ler dados, e **toda Server Action também**, como primeira instrução: uma ação é um POST que pode ser enviado sem passar pela interface. Sem sessão válida, a ação redireciona para `/entrar` (ou para `/configuracao-inicial`, se a instalação estiver incompleta) sem gravar nada.
- Os testes `tests/servidor/web/acoesPainel.test.ts` chamam as 12 ações sem cookie, com cookie forjado e com sessão revogada e conferem que nenhuma linha muda. O smoke em navegador repete isso com um POST direto ao endpoint da ação.
- Entradas vindas do navegador nunca trazem dono, versão gravada nem ordem gravada: o serviço relê tudo do banco e só usa do cliente o que ele pode decidir (campos editáveis, versão que viu, posição desejada).

## 3. Concorrência sem perda de atualização

| Operação                          | Proteção                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Editar, arquivar e restaurar      | `versaoEsperada` da atividade; divergência → 409 `conflito-de-versao`, nada é gravado e o formulário mantém o que foi digitado     |
| Mover cartão (arraste ou teclado) | `versaoEsperada` do cartão **e** a ordem completa da coluna de destino como o cliente a viu; divergência → 409 `conflito-de-ordem` |
| Reordenar colunas                 | Ordem completa das colunas como o cliente a viu                                                                                    |
| Editar e excluir status           | `versaoEsperada` do status                                                                                                         |
| Renomear e excluir tag            | Nome exibido na tela como condição (`nomeAtual`); a tabela de tags não tem coluna de versão e não foi preciso migrar               |

A versão do cartão só avança quando o status muda. Reordenar dentro da coluna não altera campo editável, e a ordem já é protegida pela conferência da coluna. No navegador, o estado otimista prevê a mesma versão (`aplicarMovimentoCartao`), então dois arrastes seguidos, feitos antes de a primeira resposta chegar, não geram conflito com o próprio usuário. Next despacha Server Actions uma de cada vez por cliente, e cada carga é calculada sobre o estado otimista do momento.

Renomear ou excluir uma tag avança a versão das atividades que a usam. Assim, um formulário aberto antes da mudança não recria a tag antiga ao ser salvo; ele é recusado como conflito.

Toda ação do quadro revalida a rota também em caso de falha. O quadro já mostra o estado gravado quando aparece o aviso de conflito.

## 4. Ordem manual

- A ordem (`ordem`) é única por status entre as atividades não arquivadas (índice parcial da rodada 1) e não depende da prioridade. Nenhuma tela ordena por prioridade.
- Como o SQLite não adia UNIQUE, a gravação é feita em duas fases dentro da transação. Primeiro a coluna inteira é deslocada para uma faixa livre, acima de qualquer valor final; depois recebe 0..n-1 (`gravarOrdemDoStatus`, `gravarPosicoesDosStatus`). Há teste com a sequência real de movimentos.
- Nova atividade, mudança de status pelo formulário e restauração colocam o cartão no fim da coluna. Ao restaurar, a posição antiga pode ter sido ocupada.

## 5. Regras de negócio adotadas

- **Conclusão** (`regrasConclusao.ts`): atividade em status com "Conclui a atividade" tem data de conclusão; nos demais status, não tem.
  - Ao entrar num status que conclui sem data, registra-se o momento atual no fuso do board.
  - Entre dois status que concluem, a data original é mantida. Isso evita perder datas de conclusão informadas antes.
  - No formulário, a data informada prevalece.
  - Mudar a opção de um status não reescreve as atividades que já estão nele.
- **Exclusão de status:**
  - Exige destino quando há atividades, inclusive arquivadas.
  - As ativas vão para o fim do destino na ordem em que estavam; as arquivadas só trocam de status; nenhuma é apagada.
  - É recusada para o último status do board e para status usado no escopo de um link de compartilhamento (RESTRICT da rodada 1).
- **Status e tags:**
  - Nomes de status são únicos ignorando acento, caixa e espaços, como tags e solicitantes.
  - A chave estável do status não muda ao renomear.
- **Tags:**
  - O cadastro é normalizado, e o vínculo N:N é sincronizado a cada salvamento.
  - A exclusão remove só a tag e os vínculos.
  - É recusada se a tag estiver no escopo de um link de compartilhamento.
- **Solicitantes:**
  - Texto livre normalizado com `garantirSolicitante`; em branco vira o solicitante padrão do board (desde a migração 0007, definido na configuração inicial e alterável em **Solicitantes**).
  - O autocomplete sugere apenas solicitantes em uso, mais o solicitante padrão. Assim, um nome digitado errado e corrigido não fica sugerido para sempre.
- **Arquivamento:**
  - Arquivar não apaga nada e não exige confirmação, porque é reversível.
  - Atividade arquivada não é editada nem movida até ser restaurada.
  - Não existe exclusão de atividade nesta rodada.
- **Lembrete:** exibido no detalhe, com a situação, e preservado ao salvar. Editar lembretes fica para a rodada de notificações: cadastrar um lembrete pendente sem disparador prometeria um aviso que nunca chegaria.

## 6. Interface

- **Quadro:**
  - Colunas por status com contagem.
  - O cartão mostra título, prioridade (P0–P9, com texto acessível), solicitante, prazo e tags. O prazo aparece como "Vencido" ou "Hoje" calculado no fuso do board, e não aparece em status que conclui.
  - Rolagem horizontal com encaixe no celular; colunas de 85vw no celular e 18rem a partir de `sm`.
- **Arraste sem dependência nova:**
  - Usa Pointer Events com captura pela alça de cada cartão e de cada coluna. Foi validado com mouse e teclado; o toque ficou fora do escopo desta rodada (seção 8). A alça tem `touch-action: none`, então o resto do cartão continua rolando a página.
  - **Atualização da rodada 6:** o arraste passou a começar de qualquer ponto do cartão (e do cabeçalho da coluna), sem captura no `pointerdown`: com mouse, depois de 5 px; no toque, depois de segurar ~250 ms parado (mexer antes é rolagem). O clique gerado ao soltar é descartado. A alça continua para teclado e leitor de tela. Detalhes em `docs/decisoes-tecnicas-interface-mcp.md`.
  - O item fica esmaecido no lugar, um indicador marca o destino e uma cópia acompanha o ponteiro. Perto das bordas há rolagem automática, e Esc cancela.
  - Pelo teclado: Espaço ou Enter na alça pega o item, as setas (Home e End vão às pontas) escolhem o destino, Espaço ou Enter solta e Esc cancela. Cada passo é anunciado numa região `aria-live`, e o foco volta à alça depois de soltar.
- **Feedback:**
  - Movimento otimista (`useOptimistic`) e indicador "Salvando…" / "Alterações salvas.".
  - Erros aparecem em `MensagemAlerta`, o componente já existente. Não foi adicionada biblioteca de toast.
  - Avisos de sucesso pós-redirecionamento vêm de um parâmetro validado contra uma lista fechada, e o parâmetro é removido da URL.
  - `not-found.tsx` em pt-BR. Não há `loading.tsx` no segmento raiz: esse limite de Suspense faria o redirecionamento de quem não tem sessão sair como 200 com meta-refresh, depois do shell, em vez do 307 validado na rodada 1. O carregamento aparece no estado pendente dos botões e no indicador do quadro.
- **Confirmação destrutiva:** `DialogoConfirmacao` usa `<dialog>` nativo com `showModal`, que dá foco preso e Esc. O botão de confirmar é o próprio envio do formulário. Usado na exclusão de status (com o seletor de destino) e de tag.
- **Formulários:**
  - Erros por campo e valores reenviados. O React 19 reinicia formulários não controlados após a ação, por isso os campos são remontados com o que o servidor devolveu.
  - Datas com `input type="date"` e `"time"`; tags com chips e `datalist`; solicitante com `datalist`.

## 7. Testes

Jest em ambiente node, SQLite em memória e nomes em pt-BR. Cobrem:

- criação, edição, movimentação e reordenação, inclusive o conflito de dois clientes;
- prioridade independente da ordem;
- regras de conclusão;
- status: criar, renomear, reordenar e excluir com destino;
- tags e solicitantes;
- arquivamento e restauração;
- esquemas Zod;
- consultas de leitura;
- lógica pura do quadro: estado otimista, cargas, alvo do arraste, teclado e indicador;
- autorização e validação das 12 Server Actions, com `next/headers`, `next/navigation`, `next/cache`, `next/server` e o banco simulados nas fronteiras.

## 8. Limitações conhecidas

- **Arraste por toque fora do escopo desta rodada** (resolvido na rodada 6 com toque longo; ver `docs/decisoes-tecnicas-interface-mcp.md`), por decisão de escopo. O código usa Pointer Events, e a alça tem `touch-action: none`, mas o arraste por toque não foi validado. Na única tentativa automatizada (toque emulado via CDP), o movimento não foi gravado, e o caso não foi investigado. No celular, o layout em 390 px foi conferido; para mover um cartão, use o campo Status do formulário de edição.
- Arrastar exige JavaScript. Sem ele, mude o status pelo formulário de edição (a atividade vai para o fim da nova coluna).
- No celular, leitores de tela que só geram toques não conseguem arrastar. A alternativa é o mesmo campo de status do formulário.
- Um conflito de concorrência é resolvido recarregando: não há mesclagem automática de edições.
- Os testes de interface são da lógica pura; o comportamento visual e de ponteiro foi conferido no smoke em navegador (Chrome sem interface, via CDP), não em testes automatizados de componente, porque o projeto não tem jsdom nem Testing Library e não foi adicionada dependência.
