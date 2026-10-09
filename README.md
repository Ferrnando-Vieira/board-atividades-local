# Board de atividades

Board Kanban local para organizar atividades, com dados num arquivo SQLite desta máquina, conta administrativa protegida, links de compartilhamento revogáveis, API para agentes (Kiro, Claude Code, Claude Cowork), anexos privados, personalização do fundo e lembretes. Não depende de nuvem, túnel nem serviço externo: roda só nesta máquina ou, por escolha explícita, na rede local.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Pré-requisitos no Windows](#2-pré-requisitos-no-windows)
3. [Instalação e primeira configuração](#3-instalação-e-primeira-configuração)
4. [Executar: desenvolvimento e produção](#4-executar-desenvolvimento-e-produção)
5. [Acesso pela rede local (LAN)](#5-acesso-pela-rede-local-lan)
6. [HTTPS e segurança](#6-https-e-segurança)
7. [API para agentes](#7-api-para-agentes)
8. [Compartilhamento por link](#8-compartilhamento-por-link)
9. [Anexos, descrição formatada e histórico](#9-anexos-descrição-formatada-e-histórico)
10. [Aparência e lembretes](#10-aparência-e-lembretes)
11. [Backup e restauração](#11-backup-e-restauração)
12. [Solução de problemas, atualização e manutenção](#12-solução-de-problemas-atualização-e-manutenção)
13. [Desenvolvimento](#13-desenvolvimento)
14. [Limitações conhecidas](#14-limitações-conhecidas)

## 1. Visão geral

**Recursos**

- **Kanban persistente:** colunas por status, cartões com prioridade (0 a 9; 0 é a mais alta), tags, solicitante e prazo. Criação por modal no próprio quadro (atalho `N`; `/` vai para a busca), filtros combináveis por tags, solicitantes e prioridades (clicar numa tag do cartão liga ou desliga o filtro), tags criadas e vinculadas direto no cartão, arraste de qualquer ponto do cartão (mouse, toque longo no celular ou teclado pela alça), reordenação de colunas pelo cabeçalho, arquivamento reversível e busca. No computador o quadro ocupa a tela: cada coluna rola por dentro e a faixa horizontal fica sempre à vista. Dentro da coluna a ordem é automática: prioridade e, no empate, a data de criação. Cada alteração é gravada na hora no SQLite, com controle de versão contra edições simultâneas.
- **Autenticação local:** uma conta administrativa, criada na primeira execução com um código de uso único exibido no terminal. Senha com scrypt e sessão em cookie `HttpOnly`.
- **Instalação limpa e configurável:** o board nasce vazio, sem atividades, tags nem nomes pré-cadastrados. O solicitante padrão (o nome gravado quando uma atividade não informa solicitante) é definido na configuração inicial e pode ser trocado depois em **Solicitantes**. Cada tag pode ter o seu próprio solicitante padrão (tela **Tags**): numa atividade salva sem solicitante, vale o da primeira tag adicionada que tiver um e, sem isso, o do board.
- **Aparência por link:** quem entra por um link nomeado pode ajustar fundo, cores e prioridades só para a própria exibição.
- **Compartilhamento:** um link padrão de visualização (somente leitura, sem login) criado na inicialização, além de links "board completo" (vê e edita) ou "restrito" (só leitura, filtrado por tags e solicitantes), revogáveis a qualquer momento.
- **API HTTP local** (`/api/v1`) com tokens próprios e permissões, para agentes integrarem sem tocar no banco, e **servidor MCP** (`npm run mcp`, já registrado no `.mcp.json`) que dá ao Claude Code, ao Kiro e a outros agentes ferramentas prontas sobre essa API.
- **Presença:** quem está com o board aberto aparece no cabeçalho; quem entra por um link nomeado aparece com o nome do link, e pelo link padrão, como um animal anônimo ("Capivara anônima", "Tucano anônimo"…).
- **Anexos privados** de até 10 MiB, guardados fora da pasta pública e baixados só com autorização; vários de uma vez, arrastando, e também na criação da atividade.
- **Descrição formatada:** Markdown com barra de formatação (negrito, listas, tarefas, links, código e blocos de código com botão Copiar), visualização antes de salvar e imagens coladas (Ctrl+V) ou arrastadas direto no texto.
- **Histórico de alterações** de cada card: quem mudou o quê e quando, com o antes e depois de cada campo.
- **Aparência:** fundo do board com cores, gradientes lineares e radiais e combinações prontas, gradiente personalizado (com ângulo também no radial) ou imagem enviada; cor e transparência dos títulos e das colunas (globais e por coluna), cores de tags e de prioridades, e cor do texto escolhida pelo contraste com o fundo.
- **Lembretes:** um por atividade e também avulsos (sem cartão), com central no cabeçalho, página própria e notificações do navegador quando ele permite.

**Stack** (versões fixadas no `package.json` e no `package-lock.json`)

| Camada               | Tecnologia                                                     |
| -------------------- | -------------------------------------------------------------- |
| Aplicação web        | Next.js 16.3.8 (App Router), React 19.2.8, TypeScript 5.9.3    |
| Estilo               | Tailwind CSS 4.3.3                                             |
| Banco                | SQLite (better-sqlite3 13.0.3) com Drizzle ORM 0.45.3 em WAL   |
| Validação            | Zod 4.6.5, os mesmos esquemas na interface, nas ações e na API |
| Descrição            | react-markdown 10.1.0, remark-gfm 4.0.1, remark-breaks 4.0.0   |
| Scripts e testes     | tsx 4.23.15, Jest 30.5.2, ESLint 9.39.5, Prettier 3.9.9        |
| Migrações de esquema | drizzle-kit 0.31.11 (só gera SQL; quem aplica é o projeto)     |

**Outros documentos**

| Documento                                                   | Conteúdo                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `docs/api-agentes.md`                                       | Referência completa da API, com permissões, erros e exemplos                 |
| `docs/decisoes-tecnicas.md`                                 | Fundação: banco e autenticação (rodada 1)                                    |
| `docs/decisoes-tecnicas-kanban.md`                          | Kanban, concorrência e ordem manual (rodada 2)                               |
| `docs/decisoes-tecnicas-compartilhamento-api.md`            | Links e API (rodada 3)                                                       |
| `docs/decisoes-tecnicas-anexos-personalizacao-lembretes.md` | Anexos, fundo e lembretes (rodada 4)                                         |
| `docs/decisoes-tecnicas-interface-mcp.md`                   | Interface nova, aparência, presença, LAN e MCP (rodada 6)                    |
| `docs/decisoes-tecnicas-descricao-historico.md`             | Descrição formatada, imagens coladas e histórico (rodada 7)                  |
| `docs/decisoes-tecnicas-solicitantes-aparencia-links.md`    | Instalação limpa, solicitantes configuráveis e aparência por link (rodada 8) |

## 2. Pré-requisitos no Windows

- **Windows 10 ou 11 de 64 bits.** O projeto foi validado em Windows x64. O `better-sqlite3` também traz binário pronto para Windows arm64, mas essa combinação não foi testada.
- **Node.js 22 ou mais recente**, com o npm que o acompanha (`engines` do `package.json`). A validação foi feita com Node.js 26.3.1 e npm 12.0.2. Confira com `node --version` e `npm --version`.
- **Não é preciso Python nem Visual Studio Build Tools:** o `better-sqlite3` 13 já vem compilado para Windows. O npm 12 bloqueia scripts de instalação de alguns pacotes (esbuild, @parcel/watcher e outros); isso é esperado e não afeta o projeto.
- **PowerShell** 5.1 (o do Windows) ou 7. Os comandos deste guia são de PowerShell.
- **Pasta num disco local**, fora do OneDrive, Dropbox ou de compartilhamentos de rede: o SQLite em modo WAL não funciona com segurança em pastas sincronizadas nem em unidades de rede.

## 3. Instalação e primeira configuração

Abra o PowerShell na pasta do projeto (por exemplo, `D:\projetos\board-atividades-local`) e execute:

```powershell
npm ci                               # instala exatamente as versões do package-lock.json
Copy-Item .env.example .env.local    # opcional: só se for mudar porta, caminhos ou rede
npm run inicializar                  # cria o banco, aplica as migrações, cria o board vazio e mostra o código
npm run build                        # gera o build de produção
npm start                            # sobe em http://127.0.0.1:3000
```

Use `npm ci`, e não `npm install`, para que nada mude no `package-lock.json`. O `.npmrc` grava versões exatas se uma dependência for adicionada no futuro.

**Variáveis de ambiente** (todas opcionais; os padrões são seguros). O `.env.local` vale para `npm run dev`, `npm start` e todos os scripts. Uma variável definida no próprio terminal tem prioridade sobre o arquivo.

| Variável               | Padrão                            | Para que serve                                                                   |
| ---------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `HOST`                 | `127.0.0.1`                       | Interface em que o servidor escuta. O padrão aceita só esta máquina              |
| `PORTA`                | `3000`                            | Porta TCP                                                                        |
| `URL_BASE_LAN`         | `http://HOST:PORTA`               | Endereço dos links de compartilhamento e da API exibido em Integrações           |
| `CAMINHO_BANCO_SQLITE` | `./dados/board-atividades.sqlite` | Arquivo do banco. Caminho relativo parte da raiz do projeto                      |
| `DIRETORIO_ANEXOS`     | `./dados/anexos`                  | Pasta privada dos anexos. Não pode ficar dentro de `public/`                     |
| `COOKIE_SEGURO`        | `false`                           | `true` só com HTTPS: o cookie de sessão ganha o atributo `Secure`                |
| `NOTIFICACOES_WINDOWS` | `true`                            | No Windows, o servidor mostra os lembretes como toast, mesmo com o board fechado |

No Windows, caminhos com barra invertida ou normal funcionam sem aspas (`D:\board\board.sqlite` ou `D:/board/board.sqlite`).

**Primeira configuração da conta administrativa**

1. Com o servidor no ar, abra `http://127.0.0.1:3000`. Sem conta criada, o board leva a `/configuracao-inicial`.
2. Informe o código que `npm run inicializar` mostrou no terminal (formato `XXXX-XXXX-XXXX-XXXX`), o usuário (3 a 60 caracteres: letras minúsculas sem acento, números, ponto, hífen ou sublinhado), uma senha de pelo menos 12 caracteres e o **solicitante padrão**: o nome gravado quando uma atividade é criada sem solicitante (normalmente o seu). Ele preenche o campo Solicitante das atividades novas e vale também para a API e o MCP; troque-o quando quiser em **menu da conta → Solicitantes**.
3. O código vale 60 minutos e cai após 5 tentativas erradas. Para emitir outro, execute `npm run admin:codigo`; o anterior deixa de valer. O banco guarda só o hash do código.
4. Depois de criada a conta, a tela de configuração deixa de existir e o acesso passa a ser por `/entrar`.

O código existe para que ninguém da rede crie a conta antes de você: faça a configuração com o servidor ouvindo só em `127.0.0.1`.

**Banco criado por uma versão anterior.** Faça `npm run backup:criar` e `npm run db:migrar` antes de `npm run build` (seção 12). A migração 0007 marca como solicitante padrão o solicitante mais antigo de cada board, que nas versões anteriores era criado junto com o board; confira e, se quiser, troque em **Solicitantes**.

## 4. Executar: desenvolvimento e produção

| Modo            | Comandos                      | Quando usar                                            |
| --------------- | ----------------------------- | ------------------------------------------------------ |
| Produção        | `npm run build` e `npm start` | Uso diário e acesso pela rede local                    |
| Desenvolvimento | `npm run dev`                 | Alterar o código nesta máquina, com recarga automática |

Os dois passam por `scripts/servidor.ts`, que lê o `.env.local` e entrega `HOST` e `PORTA` ao Next.js. Com `HOST` local (`127.0.0.1`, `localhost` ou `::1`), o terminal mostra "Servidor acessível apenas nesta máquina". Com outro valor, mostra um aviso de que a rede local poderá acessar o board.

- **Só esta máquina (padrão).** Mantenha `HOST=127.0.0.1`. É o modo recomendado para a configuração inicial, para o desenvolvimento e quando os agentes rodam no mesmo computador.
- **Rede local, por escolha consciente.** Siga a seção 5. Prefira o modo de produção: o `npm run dev` é mais pesado, mostra detalhes de erro e registra no terminal os endereços acessados (inclusive os tokens dos links). O `npm run dev` também funciona pelo IP da rede: os IPs desta máquina entram em `allowedDevOrigins` (`next.config.ts`).
- **Depois de mudar o código ou atualizar o projeto,** rode `npm run build` antes de `npm start`.

**Encerrar o servidor:** pressione `Ctrl+C` no terminal em que ele roda. Se o terminal foi fechado e a porta continua ocupada, descubra e encerre o processo:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object LocalAddress, OwningProcess
Get-Process -Id <OwningProcess>          # confira que é o node.exe do board
Stop-Process -Id <OwningProcess>
```

## 5. Acesso pela rede local (LAN)

Só libere a rede local se outros dispositivos precisarem do board, e só numa rede confiável (casa ou escritório). Nunca crie redirecionamento de porta, DMZ ou regra UPnP no roteador, nem túnel público (ngrok, Cloudflare Tunnel e afins): o board não foi feito para a internet. Leia antes a seção 6, porque sem HTTPS a senha e os tokens trafegam em texto claro.

1. **Descubra o IP desta máquina na rede:**

   ```powershell
   Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp, Manual | Select-Object InterfaceAlias, IPAddress
   ```

   Como alternativa, `ipconfig` mostra o "Endereço IPv4". Se o roteador permitir, reserve esse IP para esta máquina (reserva DHCP), para ele não mudar.

2. **Confira se a rede está como Privada** (o Windows trata redes Públicas com mais restrição, e a regra abaixo vale só para o perfil Privado):

   ```powershell
   Get-NetConnectionProfile | Select-Object InterfaceAlias, NetworkCategory
   ```

   Se a sua rede confiável aparecer como `Public`, num PowerShell como administrador: `Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private` (troque `Wi-Fi` pelo nome da interface). Não faça isso em rede de hotel, aeroporto ou de convidados.

3. **Configure o `.env.local`** para escutar em todas as interfaces e deixe `URL_BASE_LAN` vazio:

   ```dotenv
   HOST=0.0.0.0
   PORTA=3000
   URL_BASE_LAN=
   ```

   O board continua respondendo em `http://127.0.0.1:3000` nesta máquina (inclusive para agentes e o servidor MCP) e os links de compartilhamento passam a usar o IP da rede local, detectado sozinho a cada link gerado (adaptadores virtuais como WSL, Hyper-V, Docker e VPNs são ignorados). Se o IP mudar por DHCP, os links novos já saem com o IP novo. Ao iniciar, o terminal mostra os dois endereços. Para fixar um endereço (por exemplo, um nome com HTTPS), preencha `URL_BASE_LAN`; para escutar só numa interface, use `HOST=<IP>` (aí `127.0.0.1` deixa de responder). A regra do passo 4 limita o acesso à rede privada.

4. **Libere a porta só no perfil Privado e só para a sub-rede local** (PowerShell como administrador):

   ```powershell
   New-NetFirewallRule -DisplayName 'Board de atividades (TCP 3000, LAN)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private -RemoteAddress LocalSubnet
   ```

   Se o Windows mostrar o aviso do Firewall para o Node.js na primeira execução, marque apenas **Redes privadas**. O aviso cria regras para o `node.exe` em qualquer porta; revise-as com `Get-NetFirewallRule -DisplayName 'Node.js*' | Select-Object DisplayName, Profile, Action, Enabled`.

5. **Reinicie o servidor** (`npm run build` e `npm start`) e teste de outro dispositivo da mesma rede, abrindo `http://192.168.0.10:3000`. De outro Windows, a conexão pode ser conferida com `Test-NetConnection 192.168.0.10 -Port 3000` (`TcpTestSucceeded : True`).

6. **Para desfazer:** remova a regra e volte ao acesso local.

   ```powershell
   Remove-NetFirewallRule -DisplayName 'Board de atividades (TCP 3000, LAN)'
   ```

   No `.env.local`, volte a `HOST=127.0.0.1` e reinicie o servidor. Links já gerados com o endereço da LAN deixam de abrir em outros dispositivos; revogue os que não serão mais usados.

Se mudar a porta, ajuste `PORTA` (e `URL_BASE_LAN`, se estiver preenchido) e o `-LocalPort` da regra.

## 6. HTTPS e segurança

**Riscos do HTTP na rede local.** Sem HTTPS, qualquer pessoa na mesma rede (principalmente em Wi-Fi) pode capturar a senha no login, o cookie de sessão, os tokens dos links de compartilhamento e os tokens da API. Por ordem de preferência:

1. Manter `HOST=127.0.0.1` e usar o board só nesta máquina, com os agentes também nela.
2. Abrir para a LAN em HTTP só numa rede confiável, por pouco tempo, com links de validade curta e revogando o que não for mais usado.
3. Colocar HTTPS na frente com um proxy local (abaixo).

**HTTPS com proxy local (opcional, sem serviço externo).** Um proxy reverso instalado nesta máquina recebe as conexões HTTPS e repassa ao board, que continua ouvindo só em `127.0.0.1`. Com o [Caddy](https://caddyserver.com/), por exemplo, um `Caddyfile` mínimo seria:

```text
https://192.168.0.10 {
	tls internal
	reverse_proxy 127.0.0.1:3000
}
```

O `tls internal` usa uma autoridade certificadora local criada pelo próprio Caddy; o [mkcert](https://github.com/FiloSottile/mkcert) é outra opção para gerar o certificado. Nos dois casos, cada dispositivo precisa confiar na raiz dessa autoridade (instalação manual no celular e nos outros computadores). Depois:

- no `.env.local`: `HOST=127.0.0.1`, `URL_BASE_LAN=https://192.168.0.10` e `COOKIE_SEGURO=true`;
- no Firewall, libere a porta 443 do proxy, e não a 3000.

Essa montagem não faz parte do projeto e não foi validada nele. O exemplo é um ponto de partida; consulte a documentação da ferramenta escolhida.

**Cookies e contexto seguro**

- O cookie de sessão é `HttpOnly` e `SameSite=Strict` e só ganha `Secure` com `COOKIE_SEGURO=true`. O login não expira enquanto o board é usado: cada acesso renova a validade por 400 dias (o máximo que navegadores como Chrome e Edge aceitam num cookie), e a sessão só termina em **Sair** ou depois de 400 dias sem abrir o board. Com `COOKIE_SEGURO=true` e acesso por `http://<IP>`, o navegador descarta o cookie e a entrada não se completa.
- `http://127.0.0.1` e `http://localhost` contam como contexto seguro; `http://<IP-da-LAN>` não. Fora de contexto seguro, o navegador não oferece a Notification API (os lembretes ficam só na central da página) nem a cópia automática para a área de transferência (o link aparece selecionado para `Ctrl+C`).

**Links e tokens são segredos**

- O endereço de um link e um token de API aparecem uma única vez, na criação; o banco guarda só o SHA-256. Quem tem o link entra sem senha.
- Envie só para quem deve acessar, prefira validade curta (1, 7, 30, 90 ou 365 dias) e revogue assim que não for mais necessário ou ao suspeitar de vazamento: a revogação vale na requisição seguinte.
- O token do link fica no caminho da URL. Ele não vaza para outros sites (`Referrer-Policy: no-referrer`), mas fica no histórico do navegador de quem abriu e, no `npm run dev`, no terminal.

**Outras proteções e limites:** a entrada bloqueia a conta por 15 minutos após 5 senhas erradas (alguém na LAN pode provocar esse bloqueio); as respostas levam `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `Permissions-Policy`; ainda não há Content-Security-Policy nas páginas. Não edite o arquivo SQLite diretamente: isso pula validações, a gravação interna da ordem e o controle de versão.

## 7. API para agentes

A referência completa está em [`docs/api-agentes.md`](docs/api-agentes.md): permissões, formato JSON das respostas e erros, concorrência, os 37 endpoints e exemplos em PowerShell e curl. A tela **Integrações** mostra o endereço base e o catálogo de endpoints.

- **Endereço base:** `<URL_BASE_LAN>/api/v1`. Para um agente que roda nesta máquina (Kiro, Claude Code, Claude Cowork), use `http://127.0.0.1:3000/api/v1` mesmo com a LAN liberada: o token não passa pela rede.
- **Criar token:** **Integrações → Gerar token**, com um nome (por exemplo, "Kiro no notebook"), as permissões e a validade (1, 7, 30, 90 ou 365 dias, ou sem expiração). O token começa com `bat_` e aparece uma vez: copie na hora.
- **Listar e revogar:** a mesma tela lista os tokens com situação (ativo, expirado ou revogado), começo do token, criação, expiração e último uso. **Revogar** vale na requisição seguinte e não pode ser desfeito.
- **Autenticação:** cabeçalho `Authorization: Bearer <token>` em todas as requisições. Token ausente, inválido, expirado ou revogado recebe `401`; token sem a permissão do endpoint, `403`.
- **Permissões:** `board:ler`, `board:escrever` (status, tags e solicitantes), `atividades:ler` e `atividades:escrever`. Dê a cada agente só as que ele usa.
- **Formato:** corpo JSON (`Content-Type: application/json`, até 256 KiB), respostas `{ "dados": ... }` ou `{ "erro": { "codigo", "mensagem", "campos", "gerais" } }`, com mensagens de validação em pt-BR iguais às da interface.
- **Guarde o token** numa variável de ambiente da sessão do agente ou no cofre de segredos dele, nunca no prompt, no código ou em arquivo versionado.

Primeiro teste, no PowerShell desta máquina:

```powershell
$env:BOARD_TOKEN = Read-Host 'Token da API'   # cole o token; ele não fica salvo em arquivo
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1' -Headers @{ Authorization = "Bearer $env:BOARD_TOKEN" }
```

A resposta lista as permissões do token e os endpoints. Para enviar JSON com acentos pelo Windows PowerShell 5.1, informe `charset=utf-8` no `-ContentType`, como nos exemplos de `docs/api-agentes.md`.

**Servidor MCP (Claude Code, Kiro e outros agentes).** O `npm run mcp` inicia um servidor MCP por stdio com uma ferramenta para cada endpoint (`identificar_token`, `listar_atividades`, `criar_atividade`, `mover_atividade`, `anexar_arquivos`, `ler_anexo`, `definir_lembrete_atividade`, `criar_lembrete`, `editar_tag`…). Com `anexar_arquivos` o agente envia arquivos desta máquina e põe imagens na descrição; com `ler_anexo`, vê as imagens já anexadas. Ele só chama a API acima, com um token de **Integrações**:

1. Gere o token com as permissões que o agente pode ter.
2. No `.env.local`, acrescente `BOARD_API_TOKEN=bat_…` (o arquivo não vai para o Git). Com o board em outra porta ou máquina, informe também `BOARD_API_URL` (padrão `http://127.0.0.1:<PORTA>/api/v1`).
3. Abra o Claude Code na pasta do projeto: o `.mcp.json` já registra o servidor `board-atividades`; aprove-o e confira com `/mcp`.

A tela **Integrações** mostra também a configuração com caminhos absolutos para outros clientes (Kiro, Claude Desktop) e o comando `claude mcp add` para usar o board em qualquer pasta. Detalhes em `docs/api-agentes.md`, seção "Servidor MCP".

## 8. Compartilhamento por link

**Link padrão de visualização (sem login).** Ao iniciar o servidor (`npm run dev` ou `npm run start`), o board garante um link ativo **somente leitura** do board inteiro (atividades ativas, sem arquivadas e sem expiração): se já existir um válido, ele é reaproveitado, sem gerar outro token. O endereço aparece no topo de **Compartilhar board**, com **Copiar**; **Gerar novo endereço** troca o token e o anterior para de funcionar na hora. Quem abre o link não precisa de login, mas não cria, edita, move nem arquiva nada: o servidor confere a cada página, ação, busca e download, e o banco recusa (CHECK) um link padrão que permita edição. Revogado pela lista, ele é criado de novo na próxima inicialização. O token é derivado (HMAC) de uma chave aleatória guardada no arquivo `chave-link-padrao`, ao lado do banco e fora dele; o banco continua guardando só o hash. Sem essa chave (arquivo apagado ou banco restaurado em outra máquina), o endereço antigo deixa de valer e um novo é gerado.

O proprietário também gera links em **Compartilhar board**, no quadro. Cada link tem nome, modalidade, validade opcional e, no restrito, o escopo.

| Aspecto           | Board completo                                                                         | Restrito (somente leitura)                                               |
| ----------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Atividades vistas | Todas, inclusive sem tags e arquivadas                                                 | As do escopo (abaixo); arquivadas só se "Incluir arquivadas" foi marcado |
| Pode alterar      | Atividades, movimento, arquivamento, status, tags, solicitantes, anexos                | Nada                                                                     |
| Anexos            | Lista, baixa, envia e remove                                                           | Lista e baixa só os das atividades do escopo                             |
| Aparência         | Própria, só para quem entra pelo link (seção 10)                                       | Própria, só para quem entra pelo link (seção 10)                         |
| Nunca pode        | Gerar ou revogar links e tokens, mexer na conta, na aparência do board ou em lembretes | O mesmo, além de qualquer alteração no board                             |

**Escopo do restrito.** Exige ao menos uma tag ou um solicitante. Dentro de cada grupo vale **OU** (qualquer uma das tags escolhidas; qualquer um dos solicitantes escolhidos) e entre os grupos vale **E**. Um grupo sem escolha não filtra. Exemplo: tags "Faturas" e "Infra" com o solicitante "Financeiro" mostram as atividades que têm Faturas ou Infra **e** são do "Financeiro"; só com o solicitante "Financeiro", aparecem todas as dele, com ou sem tags.

**Garantias, conferidas no servidor a cada página, ação e download**

- Fora do escopo, detalhe, busca, arquivadas e download respondem como inexistentes (404), sem revelar título, tags ou anexos.
- No restrito, as telas de edição, criação, status e tags respondem 404, e as ações de gravação voltam ao quadro sem gravar nada.
- Link revogado, expirado ou inválido leva a uma página fixa sem dados do board.
- Um status ou uma tag usados no escopo de um link não podem ser excluídos enquanto ele não for revogado.
- Os links usam `URL_BASE_LAN`. Se o endereço do board mudar, o token continua valendo: ajuste o endereço do link ou gere um novo.

## 9. Anexos, descrição formatada e histórico

**Anexos**

- **Onde ficam:** os bytes vão para `DIRETORIO_ANEXOS` (padrão `dados/anexos`), com um nome interno aleatório; o nome original é só um dado no banco. A configuração recusa diretório dentro de `public/`, para que nada seja servido sem autorização.
- **Limites:** 10 MiB por arquivo; até 10 arquivos e 25 MiB por envio; 30 anexos ativos por atividade, contando as imagens coladas na descrição.
- **Enviar:** na seção **Anexos** do detalhe, escolha ou arraste vários arquivos de uma vez (tudo ou nada). Na criação, o campo **Anexos** do formulário guarda os arquivos na tela e os envia junto ao criar a atividade.
- **Imagens:** PNG, JPG, GIF e WebP aparecem com miniatura e podem ser abertas na própria aba, por `/anexos/<id>/imagem` (sessão) ou `/compartilhado/<token>/anexos/<id>/imagem` (link), com o mesmo escopo e os mesmos cabeçalhos do download. Os demais tipos continuam só como download.
- **Tipos aceitos** (catálogo fechado por extensão, com conferência dos primeiros bytes do arquivo): PDF, PNG, JPG/JPEG, GIF, WebP, TXT, CSV, MD, DOCX, XLSX, PPTX, ODT, ODS, ZIP, DOC e XLS. HTML, SVG, scripts e executáveis são recusados, inclusive com dupla extensão (`nota.pdf.exe`) ou renomeados para outra extensão.
- **Quem faz o quê:** o proprietário e o link completo enviam e removem; o link restrito só lista e baixa anexos das atividades do escopo; atividade arquivada tem anexos só para leitura.
- **Download:** sempre como arquivo baixado (`Content-Disposition: attachment`, `application/octet-stream`, `nosniff` e CSP `sandbox`), por `/anexos/<id>` (sessão) ou `/compartilhado/<token>/anexos/<id>` (link).
- **Backup:** `npm run backup:criar` copia os anexos ativos junto com o banco (seção 11).
- **Limpeza:** `npm run anexos:limpar` apaga arquivos sem anexo ativo com mais de 10 minutos (sobras de envio interrompido ou de remoção que não conseguiu apagar o arquivo). Pode rodar com o servidor no ar.
- A conferência de tipo olha a extensão e a assinatura, não o conteúdo interno (macro de DOCX, arquivos dentro de um ZIP). Não há antivírus.
- **Pela API e pelo MCP:** listar, enviar, ler e remover anexos, com as permissões `anexos:ler` e `anexos:escrever` (seção 8 e `docs/api-agentes.md`).

**Descrição formatada**

- A descrição é **Markdown** (GFM): a barra do editor aplica negrito, itálico, tachado, título, listas (marcadores, numerada e tarefas), citação, código no texto, bloco de código e link; atalhos Ctrl+B, Ctrl+I, Ctrl+K e Ctrl+E. **Visualizar** mostra o resultado antes de salvar. Linha simples continua quebrando a linha, então as descrições antigas aparecem como antes.
- **Trecho de código:** clique em **Bloco de código** e cole o trecho dentro (ou selecione o texto e clique). No detalhe, cada bloco tem o botão **Copiar**.
- **Imagens no texto:** cole uma captura de tela (Ctrl+V), arraste uma imagem para o campo ou use **Inserir imagem**. A imagem vira anexo da atividade quando ela é salva (na criação ou na edição); até lá, fica só na tela, e cancelar não deixa nada para trás. Colar com texto na área de transferência (por exemplo, células do Excel) cola o texto.
- O texto guarda a imagem como `![nome](anexo:<id>)`, e ela só aparece se o id for um anexo de imagem da própria atividade. HTML escrito na descrição aparece como texto; links abrem em outra aba, e imagem de endereço externo vira link. Remover um anexo usado na descrição avisa que a imagem passará a aparecer como indisponível.
- Pela API e pelo MCP, a descrição é lida e gravada em Markdown. Para pôr uma imagem, o agente anexa o arquivo e usa o `markdown` devolvido (`![nome](anexo:<id>)`).

**Histórico de alterações**

- A seção **Histórico de alterações**, no fim do detalhe da atividade, lista quem fez cada alteração e quando: criação, edição (com o antes e depois de cada campo e, para a descrição, os dois textos lado a lado), mudança de status, tags pelo cartão, arquivamento, restauração e anexos enviados ou removidos.
- O autor é o administrador (com o usuário), o link completo (com o nome do link) ou a integração (com o nome do token, inclusive o do MCP). Quem entra por um link vê só a origem, sem nomes.
- Agentes leem o histórico por `GET /api/v1/atividades/{id}/historico` ou pela ferramenta `ler_historico_atividade`.
- Começa a contar a partir desta versão (migração 0006). Não registra reordenar na mesma coluna, lembretes nem as operações em lote de **Status** e **Tags** (excluir status movendo as atividades, renomear ou excluir tag).

## 10. Aparência e lembretes

**Aparência.** Em **Aparência** (`/aparencia`, pelo menu da conta), o proprietário ajusta o visual do board, que vale para ele, para o link padrão e para os links nomeados que não personalizaram o seu. Quem entra por um **link nomeado** (completo ou restrito) também vê **Aparência** na barra de navegação e ajusta o visual **só para a própria exibição**: a primeira alteração copia a aparência do board e aplica a mudança por cima; a partir daí, mudanças no board não afetam esse link, até ele usar **Voltar à aparência do board**. O link padrão (público) não personaliza. Opções:

- **Fundos prontos:** padrão do tema, cores sólidas, gradientes lineares e radiais e combinações em malha, todos claros o bastante para manter contraste de pelo menos 4,5:1 com os textos (conferido por teste).
- **Gradiente personalizado:** linear ou radial, duas ou três cores e o ângulo (no radial, ele indica de que borda vem a luz: 0° topo, 90° direita); atalhos de direção, a prévia muda na hora e o board só muda ao aplicar.
- **Imagem:** PNG, JPG ou WebP de até 5 MiB, com prévia; cobre a tela sem distorcer, em qualquer tamanho. Fica em `DIRETORIO_ANEXOS/fundos` e é servida só com sessão ou link válido; cada link recebe só a imagem da aparência que exibe. **Remover imagem** volta ao fundo padrão; escolher outro fundo também tira a imagem. O arquivo só é apagado quando nenhuma aparência (do board ou de um link que a copiou) o usa mais.

- **Colunas e títulos:** cor e transparência (0 a 100%) do fundo dos títulos e do corpo das colunas. A cor do texto é escolhida sozinha (escura ou clara) pelo pior contraste com o fundo — inclusive sobre gradientes e sobre a cor média da imagem, calculada no envio —, com indicador de leitura (boa, atenção, difícil); dá para fixar texto escuro ou claro. Cada coluna pode ter cores próprias na tela **Status**.
- **Prioridades:** cor de cada nível (crítica 0–1, alta 2–3, média 4–6, baixa 7–9), usada no selo e na faixa lateral dos cartões; o texto do selo se ajusta à cor e o número continua visível.
- **Tags:** cada tag pode ter cor (tela **Tags**, paleta ou cor livre); sem cor, o chip é neutro. A cor da tag e as cores por coluna (tela **Status**) são do board, iguais para todos.

O banco guarda só chaves do catálogo, cores `#rrggbb`, porcentagens e ângulos conferidos por CHECK, nunca CSS ou URL; o estilo é montado no servidor. Os cartões ficam sempre sobre superfície opaca. A aparência do board fica em `fundos_board`; a de cada link nomeado, em `aparencias_link`.

**Lembretes.** Um por atividade, gerenciado só pelo proprietário na seção **Lembrete** do detalhe da atividade: criar ou remarcar (data e hora no fuso do board, `America/Sao_Paulo`), desativar, reativar e excluir. Horário no passado é recusado. Agentes fazem o mesmo pela API e pelo MCP, com a permissão `atividades:escrever`.

- **Central de lembretes:** botão **Lembretes** no cabeçalho do proprietário, com os avisos disparados ainda não dispensados. A lista sobrevive a recarregar a página e **Dispensar** é gravado no banco.
- **Quando dispara:** a página verifica a cada 30 segundos e ao voltar para a aba, só com o board aberto no navegador do proprietário. Com o board fechado no horário, o aviso aparece como **Atrasado** na próxima abertura. Atividade arquivada não dispara.
- **Sem duplicidade:** o servidor marca o disparo uma única vez, mesmo com várias abas ou dispositivos, e o navegador não repete a mesma notificação.
- **Toast do Windows pelo servidor:** com `npm run dev` ou `npm start` no Windows, um vigia verifica os lembretes a cada 10 s e mostra o toast nativo no horário, **mesmo com o navegador fechado** (basta o servidor estar rodando). Clicar no toast abre o lembrete no navegador padrão. Desligue com `NOTIFICACOES_WINDOWS=false`. Se o Windows não mostrar, confira _Configurações > Sistema > Notificações_ (o aviso aparece como "Windows PowerShell") e o modo Não Perturbe. Quem dispara primeiro, o vigia ou uma aba aberta, leva o aviso: com o vigia ativo, o painel do board não abre sozinho, e o lembrete aparece na lista **Avisos** até ser dispensado.
- **Notificações do sistema (Notification API):** opcionais, pedidas só no clique em **Ativar notificações do navegador**. Exigem permissão concedida e contexto seguro (`http://127.0.0.1`, `http://localhost` ou HTTPS). Pelo IP da LAN em HTTP, com permissão negada ou em navegadores que não aceitam notificações sem service worker (como o Chrome no Android), os avisos aparecem só na central.
- Não há push, service worker nem serviço remoto: com o navegador fechado, nenhum aviso é exibido na hora.
- **Lembretes avulsos:** para avisos sem atividade ("ligar para o fornecedor às 15h"). Crie pelo **+ Novo lembrete** da central ou na página **Lembretes** (`/lembretes`), com título, data, hora e observação; lá também se edita (remarca), desativa, reativa e exclui. Disparam com as mesmas garantias dos lembretes de atividade, e a aba **Próximos** da central junta os das duas origens. Agentes também criam, remarcam, desativam, reativam e excluem lembretes avulsos pela API e pelo MCP (permissões `atividades:ler` e `atividades:escrever`; veja `docs/api-agentes.md`).

**Presença.** Os avatares no cabeçalho mostram quem mais está com o board aberto: o proprietário aparece como **Proprietário do board** (sem expor o usuário) e quem entra por link, com o nome do link (links nomeados) ou, no link padrão, como um dos 15 animais da fauna brasileira com "anônimo/anônima". Cada link pode fixar o animal (campo **Animal** ao gerar o link ou **Alterar animal** na lista); sem escolha, o animal é sorteado entre os livres. O navegador manda um sinal a cada 15 segundos e avisa ao fechar a aba; a lista fica só na memória do servidor (reiniciar zera) e nenhum identificador do visitante sai do servidor.

## 11. Backup e restauração

O backup copia o banco por meio da API de backup do próprio SQLite, que gera um retrato consistente e inclui o que ainda está no arquivo `-wal`. Junto vão os anexos ativos, conferidos pelo SHA-256 gravado no banco, e um `manifesto-backup.json` com o hash do banco e as contagens. A cópia do banco fica num arquivo único (sem `-wal` nem `-shm`).

Ficam de fora a imagem de fundo (`DIRETORIO_ANEXOS\fundos`) e a chave do link padrão (`dados\chave-link-padrao`). Depois de restaurar sem elas, o board mostra o fundo padrão até uma imagem nova ser enviada, e a próxima inicialização gera outro endereço para o link padrão. Para manter os dois, copie também esses arquivos.

**Criar**

1. Pare o servidor (`Ctrl+C`). O banco seria copiado com consistência mesmo com ele no ar, mas um anexo removido durante a cópia faria o backup falhar.
2. Execute um dos comandos:

   ```powershell
   npm run backup:criar                          # em dados\backups\backup-<data-hora>
   npm run backup:criar -- "E:\backups-board"    # em outra pasta ou disco
   ```

3. Copie a pasta `backup-<data-hora>` para outro disco ou pendrive e confira a cópia:

   ```powershell
   npm run backup:verificar -- "E:\backups-board\backup-2026-10-02T12-00-00-000Z"
   ```

   A verificação confere o hash do banco, `integrity_check`, chaves estrangeiras, migrações e o hash de cada anexo, sem alterar nada na pasta.

**Restaurar**

1. Pare o servidor. Com ele no ar, o Windows não deixa mover o banco e a restauração para sem alterar nada.
2. Simule (só confere e mostra o destino): `npm run backup:restaurar -- "<pasta-do-backup>"`.
3. Restaure: `npm run backup:restaurar -- "<pasta-do-backup>" --confirmar`. O banco atual, com seus `-wal` e `-shm`, e a pasta de anexos vão para `antes-da-restauracao-<data-hora>`, ao lado do banco; nada é apagado. Se qualquer etapa falhar, tudo volta ao lugar.
4. Se o comando avisar que há migrações pendentes (backup de uma versão anterior), execute `npm run db:migrar`.
5. Inicie o servidor, confira o board e só então apague a pasta `antes-da-restauracao-…`.

O backup só é restaurado por uma versão do projeto que conheça todas as migrações dele; uma versão mais antiga recusa.

**Testar um backup numa cópia temporária**, sem tocar no banco em uso: as variáveis definidas no terminal têm prioridade sobre o `.env.local`.

```powershell
$env:CAMINHO_BANCO_SQLITE = "$env:TEMP\teste-board\board-atividades.sqlite"
$env:DIRETORIO_ANEXOS = "$env:TEMP\teste-board\anexos"
npm run backup:restaurar -- "<pasta-do-backup>" --confirmar
$env:PORTA = '3100'; npm start                # opcional: abra http://127.0.0.1:3100 e confira
Remove-Item Env:CAMINHO_BANCO_SQLITE, Env:DIRETORIO_ANEXOS, Env:PORTA
Remove-Item -Recurse -Force "$env:TEMP\teste-board"
```

O `npm start` precisa do build (`npm run build`) e é encerrado com `Ctrl+C` antes das duas últimas linhas.

**Sobre WAL e SHM.** Com o servidor no ar, gravações recentes podem estar só em `board-atividades.sqlite-wal`, e o `-shm` é o índice desse arquivo. Por isso, nunca copie só o `.sqlite` com o servidor rodando. Numa cópia manual, pare o servidor e copie os três arquivos que existirem, mais a pasta de anexos. Ao restaurar manualmente, nunca deixe um `-wal` antigo ao lado do banco restaurado: o SQLite o aplicaria e corromperia o banco. Os scripts acima já cuidam disso.

## 12. Solução de problemas, atualização e manutenção

| Sintoma                                                                 | Causa provável e solução                                                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| "Banco não encontrado" ou tela "O banco de dados ainda não existe"      | Banco ausente ou `CAMINHO_BANCO_SQLITE` apontando para outro lugar. Confira o `.env.local` e rode `npm run inicializar` |
| Tela "migrações pendentes" ou API `503 instalacao-incompleta`           | Versão nova sobre banco antigo. Faça o backup e rode `npm run db:migrar`                                                |
| `Could not find a production build`                                     | Falta o build: `npm run build`                                                                                          |
| `EADDRINUSE` ao iniciar                                                 | Porta ocupada. Veja o processo com `Get-NetTCPConnection -LocalPort 3000 -State Listen` ou mude `PORTA`                 |
| `EADDRNOTAVAIL` ao iniciar                                              | O IP de `HOST` não é mais desta máquina (o DHCP trocou). Atualize `HOST` e `URL_BASE_LAN`                               |
| Outro dispositivo não abre o board                                      | Confira `HOST`, o perfil Privado da rede, a regra do Firewall e `Test-NetConnection <IP> -Port 3000` (seção 5)          |
| Pelo IP, no `npm run dev`, a página abre sem interatividade             | O IP não estava em `allowedDevOrigins` (IP novo depois de iniciar). Reinicie o `npm run dev` ou use o modo de produção  |
| A entrada não se completa por `http://<IP>`                             | `COOKIE_SEGURO=true` sem HTTPS. Volte para `false` ou use HTTPS (seção 6)                                               |
| "O acesso foi bloqueado temporariamente" na entrada                     | 5 senhas erradas seguidas. Aguarde 15 minutos                                                                           |
| Código de configuração recusado, expirado ou bloqueado                  | Gere outro com `npm run admin:codigo`; o anterior deixa de valer                                                        |
| Notificações do sistema não aparecem                                    | Precisa de contexto seguro, permissão concedida e o board aberto (seção 10). Os avisos continuam na central             |
| API responde `400 json-invalido` para texto com acento (PowerShell 5.1) | Envie com `-ContentType 'application/json; charset=utf-8'` (exemplos em `docs/api-agentes.md`)                          |
| "Informe o solicitante: este board ainda não tem solicitante padrão"    | O padrão não foi definido (ou o banco veio de uma versão anterior sem solicitantes). Defina um em **Solicitantes**      |

**Atualizar o projeto para uma versão nova**

1. Pare o servidor e faça `npm run backup:criar`.
2. Substitua os arquivos do projeto pela versão nova, sem apagar a pasta `dados` nem o `.env.local`.
3. Execute `npm ci`, `npm run db:migrar` e `npm run build`.
4. Inicie com `npm start`.

As migrações ficam em `servidor/banco/migracoes/` (0000 fundação, 0001 compartilhamento e API, 0002 anexos, fundo e lembretes, 0003 fundos personalizados e link padrão, 0004 cores e transparências, cores de tags e status e lembretes avulsos; 0005 animal fixo por link de compartilhamento; 0006 histórico de alterações das atividades; 0007 solicitante padrão configurável; 0008 solicitante padrão por tag; 0009 aparência própria dos links nomeados) e são aplicadas em ordem, numa única transação; repetir `npm run db:migrar` não altera nada. Também `npm run inicializar` aplica as pendentes.

**Caminhos locais** (todos dentro de `dados/`, ignorada pelo Git, salvo configuração diferente):

| Caminho                              | Conteúdo                                                   |
| ------------------------------------ | ---------------------------------------------------------- |
| `dados/board-atividades.sqlite`      | Banco; `-wal` e `-shm` ao lado são parte dele              |
| `dados/anexos/`                      | Arquivos dos anexos (nomes internos aleatórios)            |
| `dados/backups/`                     | Destino padrão de `npm run backup:criar`                   |
| `dados/antes-da-restauracao-<data>/` | Estado guardado por `npm run backup:restaurar --confirmar` |
| `.env.local`                         | Configuração local (raiz do projeto, ignorado pelo Git)    |
| `.next/`                             | Build de produção, recriado por `npm run build`            |

**Redefinição segura (recomeçar do zero).** Pare o servidor, faça `npm run backup:criar`, renomeie a pasta (`Rename-Item dados dados-antigo`), rode `npm run inicializar` e configure a conta e o solicitante padrão de novo. Os dados antigos ficam no backup e em `dados-antigo`.

**Reset de fábrica (`npm run resetar-board`).** Apaga **sem backup** o banco (com `-wal` e `-shm`), a pasta de anexos (com as imagens de fundo) e a chave do link padrão, e em seguida faz o mesmo que `npm run inicializar`. Isso inclui a conta administrativa, os tokens da API (o MCP para de funcionar até um novo token ser gerado em Integrações) e os links de compartilhamento. A pasta `dados/backups` fica. O script lista o que será apagado e pede que se digite `RESETAR`; `npm run resetar-board -- --confirmar` pula a pergunta. Exige o servidor e o MCP parados: com o banco em uso nada é apagado. Para guardar os dados antes, rode `npm run backup:criar`.

**Senha esquecida.** Esta versão não tem redefinição de senha: depois de criada a conta, `npm run admin:codigo` recusa emitir código novo. Guarde a senha num gerenciador de senhas. Recomeçar do zero (acima) cria outra conta, mas com um board novo.

## 13. Desenvolvimento

```powershell
npm run dev                  # servidor de desenvolvimento (127.0.0.1:3000)
npm run lint                 # ESLint
npm run typecheck            # tipos das rotas (next typegen) + tsc --noEmit
npm test                     # Jest: SQLite em memória e pastas temporárias
npm run prettier:check       # confere a formatação
npm run prettier             # formata o projeto
npm run db:gerar-migracao    # após mudar servidor/banco/esquema/, gera a próxima migração SQL
npm run mcp                  # servidor MCP por stdio (normalmente iniciado pelo próprio agente)
```

- O código segue `app/` fino (só rotas), telas em `screens/`, regras e acesso a dados em `servidor/`, utilitários em `util/` e testes em `tests/`, espelhando as pastas. Textos de interface ficam em arquivos `textos*.ts` por tela.
- Revise toda migração gerada antes de aplicá-la: o `drizzle-kit` às vezes recria tabelas, o que dentro da transação do migrador apagaria dados em cascata. As migrações 0001 a 0004 e a 0007 foram ajustadas à mão por esse motivo (detalhes nos documentos de decisões técnicas e no comentário de cada SQL).
- Os testes nunca usam `dados/`: bancos e anexos de teste ficam em memória ou em pastas temporárias, apagadas ao fim de cada suíte.

## 14. Limitações conhecidas

- Sem HTTPS embutido: na LAN em HTTP, senha, cookie, links e tokens trafegam em texto claro (seção 6).
- Uma única conta administrativa, sem redefinição de senha; o bloqueio por senha errada vale para a conta inteira.
- Sem o vigia do Windows (outro sistema ou `NOTIFICACOES_WINDOWS=false`), lembretes só com o board aberto no navegador do proprietário; sem push nem service worker. A Notification API exige contexto seguro.
- Arraste por toque usa toque longo (cerca de 0,25 s parado); foi conferido em emulação de celular, não em aparelho físico. O formulário de edição continua sendo alternativa para mudar o status.
- A presença fica na memória do servidor: reiniciá-lo zera a lista até o próximo sinal (15 s). Abas em segundo plano mandam sinais com menos frequência e podem sumir da lista.
- Sem Content-Security-Policy nas páginas, sem limite de requisições e sem auditoria por requisição.
- API (e servidor MCP) sem endpoints de anexos, do histórico nem do lembrete de cada atividade (só dos lembretes avulsos), e sem paginação. Por isso agentes não enviam imagens para a descrição.
- O histórico não registra as operações em lote de status e tags, nem os lembretes.
- Validado só com Node.js 26.3.1 e npm 12.0.2 em Windows x64. A validação foi feita por testes automatizados e build, sem navegador real nas rodadas 3, 4 e 5.
