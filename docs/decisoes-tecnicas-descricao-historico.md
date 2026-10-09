# Decisões técnicas — descrição formatada, imagens coladas, anexos e histórico (rodada 7)

Data: 09/10/2026. Escopo: formatação da descrição da atividade (inclusive trechos de código), imagens coladas ou arrastadas para a descrição, anexos no formulário de criação e envio de vários arquivos de uma vez, e histórico de alterações do card. As decisões das rodadas anteriores continuam valendo, em especial as de anexos privados (`docs/decisoes-tecnicas-anexos-personalizacao-lembretes.md`).

## 1. Descrição em Markdown

- **Formato.** A coluna `atividades.descricao` continua sendo texto; o texto passa a ser lido como Markdown (CommonMark + GFM: tabelas, listas de tarefas, tachado e links automáticos). Nada muda no banco nem na API: o agente que já escreve Markdown (Claude pelo MCP) passa a ter a formatação exibida.
- **Por que Markdown, e não um editor visual.** Um editor visual (HTML ou JSON de documento) exigiria sanitizar HTML no servidor e na tela, e a API/MCP teriam de converter formatos. Markdown é texto: a busca continua funcionando, o histórico mostra o antes e depois legível, e o agente lê e escreve no mesmo formato da tela.
- **Descrições antigas.** Quebra de linha simples continua quebrando a linha (`remark-breaks`), como no texto puro de antes. As 7 descrições existentes no banco foram passadas pelo mesmo parser: todas viram só parágrafos e texto, então aparecem como antes.
- **Renderização segura.** `react-markdown` monta elementos React, sem `dangerouslySetInnerHTML`.
  - HTML escrito na descrição aparece **como texto** (um plugin troca os nós `html` por texto, e bloco de HTML vira parágrafo). Um relato como `Erro na <Lista>` não some, e `<script>` nunca vira elemento.
  - Links passam pela regra padrão do `react-markdown` (sem `javascript:`, `data:` etc.) e abrem em outra aba com `rel="noopener noreferrer"`.
  - Imagem externa (`![x](https://…)`) vira link: a página não busca nada fora do board sem o usuário pedir.
- **Dependências novas:** `react-markdown` 10.1.0, `remark-gfm` 4.0.1 e `remark-breaks` 4.0.0, com versão exata como as demais. São pacotes só ESM; o `jest.config.mjs` lê a árvore de dependências instalada e deixa o Jest transformar só esses pacotes.

## 2. Editor da descrição

- O campo continua sendo um `textarea` não controlado do formulário (a fotografia de "há alterações não salvas" e o reenvio dos valores depois de um erro seguem iguais). A barra só edita o texto dele.
- **Barra de formatação:** negrito, itálico, tachado, título, listas (marcadores, numerada, tarefas), citação, código no texto, **bloco de código** e link, mais **Inserir imagem**. Atalhos: Ctrl+B, Ctrl+I, Ctrl+K e Ctrl+E. A barra segue o padrão "toolbar" da WAI-ARIA (um ponto de Tab, setas entre os botões), e o clique num botão não tira a seleção do campo.
- **Trecho de código:** sem seleção, o botão abre um bloco vazio com o cursor dentro, pronto para o Ctrl+V; com seleção, o trecho vai para dentro do bloco, em linhas próprias. A cerca cresce quando o trecho já tem ` ``` `. Código com várias linhas no botão de código no texto vira bloco. No detalhe, cada bloco tem o botão **Copiar** (sem contexto seguro, como em `http://IP`, o código fica selecionado para o Ctrl+C).
- As alterações passam por `execCommand('insertText')`, para o Ctrl+Z do navegador desfazer a formatação; onde não houver, o texto é trocado direto no campo.
- **Visualizar** mostra o texto como vai ficar, inclusive as imagens coladas ainda não salvas (por URL `blob:` local).
- As funções de formatação são puras (`screens/atividades/formatacaoDescricao.ts`) e testadas sem navegador.

## 3. Imagens na descrição

- **Imagem é anexo.** Colar (Ctrl+V), arrastar ou escolher uma imagem cria um anexo da atividade, com as mesmas regras dos demais: catálogo fechado, assinatura conferida, nome interno aleatório, arquivo privado. Só PNG, JPG, GIF e WebP entram na descrição (SVG continua fora).
- **Referência, não endereço.** O texto guarda `![nome](anexo:ID)`. Quem exibe decide a rota: `/anexos/ID/imagem` no painel e `/compartilhado/<token>/anexos/ID/imagem` no link. A imagem só aparece se o ID for um anexo de imagem **da própria atividade**; qualquer outra referência aparece como "Imagem indisponível", mesmo que o acesso alcance o outro anexo.
- **Envio só ao salvar.** Enquanto a atividade não é salva, a imagem fica na tela e o texto usa `anexo-novo:CHAVE` (chave aleatória de `crypto.getRandomValues`, que existe também fora de contexto seguro). Ao salvar, os arquivos vão com o formulário; numa única transação a atividade é gravada, os anexos são inseridos e cada `anexo-novo:CHAVE` vira `anexo:ID`. Cancelar a edição não deixa anexo para trás, e a criação também aceita imagens (ainda não há atividade para receber um envio imediato).
  - Imagem cuja referência foi apagada do texto antes de salvar é descartada no envio.
  - A troca de `anexo-novo:CHAVE` por `anexo:ID` nunca aumenta o texto, então o limite de 20.000 caracteres continua valendo.
  - Colar com texto na área de transferência (Excel e Word põem também uma imagem das células) cola o texto: só a captura de tela ou o "copiar imagem" viram imagem.
- **Consistência:** todos os arquivos do envio são validados antes de o primeiro ir para o disco; depois de gravados, a transação da atividade insere os metadados. Se a validação, a gravação ou a transação falharem (versão vencida, limite de anexos, atividade arquivada), os arquivos gravados são apagados e nada do envio fica pela metade.
- **Rota de exibição:** responde só para PNG, JPEG, GIF e WebP, com o tipo gravado no envio (do catálogo, conferido pela assinatura), `Content-Disposition: inline`, `nosniff`, CSP `default-src 'none'; sandbox` e `private, no-store`, como o download. Outros tipos respondem 404 ali e continuam só como download. O escopo do link vale de novo a cada imagem.
- **Remover** um anexo usado na descrição avisa que a imagem passará a aparecer como indisponível.

## 4. Anexos

- **Vários de uma vez:** a seção de anexos aceita até 10 arquivos por envio (seletor múltiplo ou arrastando sobre a seção), tudo ou nada.
- **Na criação:** o formulário de nova atividade tem o campo **Anexos**; os arquivos ficam na tela e vão junto ao criar. Na edição, os anexos continuam na seção própria do detalhe.
- **Miniaturas:** anexos de imagem aparecem com miniatura, que abre a imagem inteira em outra aba.
- **Limites** (`config/anexos.ts`): 10 MiB por arquivo (igual), **10 arquivos e 25 MiB por envio** e **30 anexos por atividade** (antes 20), porque as imagens coladas também contam. O limite de corpo das Server Actions passou a 25 MiB + 512 KiB de margem; um teste confere o alinhamento.

## 5. Histórico de alterações

- **Migração 0006:** tabela nova `historico_atividades` (`atividade_id`, `tipo`, `origem`, `autor`, `alteracoes` JSON, `ocorrido_em`), com CHECK de tipo, origem, autor, lista JSON e formato do instante, e índice por atividade e data. Só `CREATE TABLE` e `CREATE INDEX`: nenhuma tabela existente é recriada. O histórico começa a contar a partir desta versão; atividades antigas não têm eventos anteriores.
- **O que entra:** criação, edição (campos alterados), movimento para outro status (com a conclusão gravada), tags rápidas do cartão, arquivamento, restauração e anexos enviados ou removidos (inclusive as imagens coladas).
- **O que não entra:** reordenar na mesma coluna, salvar sem mudar nada, lembretes (avisos pessoais do administrador, e o histórico também é visto pelos links) e as operações em lote de cadastro (excluir status movendo as atividades, excluir ou renomear tag).
- **Valores como eram exibidos.** Cada alteração guarda `{ campo, antes, depois }` com os nomes daquele momento (status, solicitante, tags), então renomear um status depois não reescreve o passado. A descrição guarda o texto inteiro antes e depois, e o detalhe mostra os dois lado a lado.
- **Mesma transação.** O evento é gravado na transação da própria operação: se ela for desfeita, o evento também é.
- **Quem alterou:** `painel` (usuário da sessão), `link` (nome do link completo), `api` (nome do token; inclui o MCP) ou `sistema` (scripts). O administrador vê o nome; quem entra por um link vê só a origem ("Link compartilhado", "Integração (API)").
- **Exibição:** seção recolhida no fim do detalhe, com os 200 registros mais recentes e o total.

## 6. Limitações

- A API e o MCP leem e gravam a descrição em Markdown, mas não enviam imagens (não há endpoints de anexos) nem leem o histórico.
- O histórico não tem filtro nem exportação, e não registra as operações em lote de status e tags.
- A conferência do Markdown é só de exibição: o texto gravado continua sendo o que foi digitado.
