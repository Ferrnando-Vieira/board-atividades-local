# Decisões técnicas — interface, aparência, lembretes avulsos, presença, rede local e MCP (rodada 6)

Data: 02/10/2026. Escopo: modernização do layout do board e do cabeçalho, correção do ângulo do gradiente radial, cores e transparência das superfícies com cor de texto automática, cores de tags, prioridades e colunas, arraste de qualquer ponto do cartão, lembretes sem atividade, presença anônima de quem vê o board, acesso pela rede local com IP automático e servidor MCP. As decisões das rodadas anteriores continuam valendo; nenhuma dependência nova foi adicionada.

## 1. Migração 0004

| Mudança                                                                                                     | Motivo                                                                      |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `fundos_board`: `cor_titulos`, `cor_colunas`, `opacidade_titulos`, `opacidade_colunas` (0–100), `tom_texto` | Cor e transparência das superfícies sobre o fundo e escolha da cor do texto |
| `fundos_board.imagem_cor_media`                                                                             | Estimar o tom de uma imagem de fundo para o contraste                       |
| `fundos_board.cor_prioridade_critica/alta/media/baixa`                                                      | Cores configuráveis por nível de prioridade                                 |
| `status_board.cor_titulo`, `status_board.cor_coluna`                                                        | Cores próprias por coluna (nulas = cores globais)                           |
| `tags.cor`                                                                                                  | Cor por tag (nula = chip neutro)                                            |
| Tabela `lembretes_avulsos` (mesmos CHECKs de coerência dos lembretes de atividade)                          | Lembretes sem cartão                                                        |

Como nas migrações 0001 a 0003, o SQL gerado pelo drizzle-kit (que recriava `status_board` e `tags`) foi reescrito com `ALTER TABLE … ADD … CONSTRAINT CHECK`, porque recriar tabelas referenciadas dentro da transação do migrador, com chaves estrangeiras ativas, esbarraria nas atividades. Toda cor passa pelo CHECK `GLOB '#[0-9a-f]…'` e pelo Zod; o CSS continua sendo montado no servidor, nunca gravado.

## 2. Gradiente radial com ângulo

O ângulo era gravado, mas o radial sempre nascia no topo e o controle continuava ativo. Agora o ângulo diz de que borda vem a luz, na convenção do linear: o centro da elipse fica em `(50 + 50·sen θ, 50 − 50·cos θ)` em porcentagem (0° = `50% 0%`, idêntico ao antigo "at top"). A tela troca o rótulo para "Direção da luz", oferece atalhos de 45° em 45° e campo numérico, e avisa quando há alterações não aplicadas.

## 3. Superfícies e cor do texto

- As colunas passaram a ter duas superfícies: título e corpo. Cor e opacidade vão como variáveis CSS (`--cor-coluna`, `--opacidade-coluna`…) e os utilitários `superficie-titulo`/`superficie-coluna` usam `color-mix(… transparent)` com `backdrop-filter`.
- O tom do texto (`data-tom="escuro|claro"`) é escolhido em `util/CorUtils.ts` (`escolherTomTexto`): para cada tom, calcula-se o contraste WCAG do texto principal e do suave sobre a mistura superfície+fundo em cada cor de amostra do fundo (cores do preset ou do gradiente, cor média da imagem, ou preto e branco quando não se sabe nada) e fica o tom com o melhor pior caso. O título usa como amostra a cor efetiva da coluna sob ele. A Aparência mostra o contraste resultante (boa ≥ 4,5:1, atenção ≥ 3:1, difícil).
- Texto claro ganha uma sombra discreta (`--sombra-texto-superficie`), que ajuda em fundos saturados de luminância média, onde nenhum tom chega a 4,5:1.
- A cor média da imagem é calculada no navegador (canvas 32×32) no envio: o projeto não tem biblioteca de imagem no servidor. É só um palpite para o contraste; valor fora do formato é descartado.
- Os cartões continuam sempre opacos e com o texto padrão do tema.
- Títulos de página postos direto sobre o fundo (`CabecalhoPagina`) e o "Carregando…" seguem o tom do fundo (`data-tom` no `<main>`).
- Prioridades: cada nível tem cor própria (variáveis `--cor-prioridade-*`, com o texto escolhido por `corTextoSobre`). Ícone e número continuam visíveis, para não depender só da cor.

## 4. Arraste de qualquer ponto do cartão

- O `pointerdown` no cartão (ou no cabeçalho da coluna) só registra o gesto, sem `preventDefault` nem captura: título, tags e "+tag" continuam funcionando com clique.
- A decisão de começar é pura e testada (`decidirInicioArraste`): mouse/caneta depois de 5 px; toque depois de ~250 ms parado, desistindo se o dedo andar mais de 8 px (é rolagem). Só então o elemento captura o ponteiro e aparece o fantasma (cópia do cartão com leve rotação).
- No toque, durante o arraste, `touchmove` (não passivo) e o menu de toque longo são bloqueados.
- Depois de soltar, o próximo clique é descartado uma vez, para soltar sobre o título não abrir a atividade. O link tem `draggable={false}` e o cartão cancela o `dragstart` nativo.
- A alça continua como botão (mesmo rótulo e atributos), discreta, para teclado e leitor de tela.
- No desktop o quadro ocupa a tela (`layout="tela-cheia"`): colunas rolam por dentro e a rolagem automática do arraste também vale para a lista sob o ponteiro.

## 5. Lembretes avulsos

Tabela própria em vez de "atividade fantasma": não aparecem no quadro, não têm status nem tags. O serviço (`lembretesAvulsosServico.ts`) repete as garantias dos lembretes de atividade: instante em UTC a partir de data e hora no fuso do board, recusa de horário passado, disparo único por `UPDATE` condicional em transação `IMMEDIATE`, dispensa pelo instante exibido e versão para edições. A sincronização da central junta as duas origens; a chave de notificação dos avulsos tem prefixo próprio (`avulso-<id>@<instante>`) e a das atividades não mudou, para não repetir avisos já exibidos.

## 6. Presença anônima

- Estado só em memória (`globalThis`), sem tabela: presença é efêmera e o board roda num único processo. Funções puras com relógio injetado.
- Sinal a cada 15 s (`POST /presenca` para o proprietário, `POST /compartilhado/<token>/presenca` para links), validade de 40 s, saída imediata por `sendBeacon` no `pagehide`.
- O identificador do visitante é gerado no navegador com `crypto.getRandomValues` (`randomUUID` não existe em `http://IP`) e guardado no `localStorage`; nunca volta na resposta — a lista usa um hash curto.
- Animal sorteado entre os livres (repete só com os dez em uso) e lembrado por 12 h para o mesmo navegador. O proprietário aparece como "Proprietário do board", uma vez só, sem expor o usuário a quem entra por link.
- As rotas exigem `Content-Type: application/json` (sem CORS, outra origem não consegue enviar) e limitam o corpo; sem sessão ou com link inválido respondem 401/404 sem redirecionar, porque o sinal roda em segundo plano.

## 7. Rede local

- Com `HOST=0.0.0.0` e `URL_BASE_LAN` vazio, a URL base dos links é `http://<IP da LAN>:<PORTA>`, detectada a cada link (`obterUrlBaseLan`), preferindo 192.168, depois 10 e 172.16–31, e ignorando loopback, link-local e adaptadores virtuais (WSL, Hyper-V, Docker, VirtualBox, VMware, VPNs). `127.0.0.1` continua respondendo nesta máquina.
- `next.config.ts` coloca os IPs da LAN em `allowedDevOrigins`, para o `npm run dev` funcionar com interatividade a partir de outro computador.
- A regra de firewall (perfil Privado, `LocalSubnet`) continua sendo passo manual do proprietário, como administrador.

## 8. Servidor MCP

- **Sem SDK:** JSON-RPC 2.0 por linhas no stdio, com `initialize` (negociação de versão), `ping`, `tools/list` e `tools/call`. É pouco código, testado, e mantém a política de não adicionar dependências.
- **Só cliente da API:** cada ferramenta faz a requisição HTTP do endpoint correspondente com `BOARD_API_TOKEN`; nada abre o SQLite, e permissões, validação e concorrência são as da API.
- **Uma ferramenta por endpoint:** o mapa de ferramentas é um `Record` com todas as chaves de `ENDPOINTS_API`, então um endpoint novo sem ferramenta não compila. Os esquemas de entrada vêm de `esquemasApi.ts` (convertidos com `z.toJSONSchema`); erros voltam como resultado com `isError`, para o agente corrigir.
- **Execução:** `node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/servidorMcp.ts` (no `.mcp.json`), evitando `npx` (que no Windows exige `cmd /c`) e funcionando mesmo com o cliente iniciando o processo em outra pasta. O `loadEnvConfig` roda com logger silencioso, porque o padrão escreve no stdout e corromperia o protocolo.

## 9. Limitações

- Arraste por toque conferido em emulação, não em aparelho físico.
- Presença zera ao reiniciar o servidor e abas em segundo plano podem sumir da lista (navegadores espaçam os temporizadores).
- A cor média da imagem é uma estimativa: imagens com regiões muito claras e muito escuras podem ter trechos com leitura pior que a indicada.
- Sem endpoints (nem ferramentas MCP) de anexos e lembretes, como antes. (Os lembretes avulsos ganharam endpoints e ferramentas depois, com as permissões `atividades:*`: veja `docs/api-agentes.md`.)
