export const textosMcp = {
  titulo: 'Board de atividades',
  instrucoes:
    'Ferramentas para ler e alterar o board de atividades local pela API HTTP. Antes de alterar uma atividade, um status ou um lembrete, leia-o para obter a versão atual e envie-a em versaoEsperada; se receber conflito-de-versao, leia de novo e repita. Comece por identificar_token para ver as permissões do token em uso. Prioridade vai de 0 (mais alta) a 9 (mais baixa) e define a ordem na coluna, que é automática. Em atualizar_atividade, tags substitui a lista inteira. Datas no formato aaaa-mm-dd e horas hh:mm, no fuso do board. A descrição é Markdown: use blocos de código com três crases e a linguagem (```ts). Para pôr uma imagem na descrição, anexe o arquivo com anexar_arquivos e coloque o "markdown" devolvido no campo descricao. Lembretes avulsos (sem atividade) têm ferramentas próprias; todo lembrete só aceita data e hora futuras.',
  tokenAusente:
    'BOARD_API_TOKEN não configurado. Gere um token em Integrações no board e coloque BOARD_API_TOKEN=bat_… no arquivo .env.local do projeto (ou na variável de ambiente do servidor MCP).',
  boardIndisponivel: (urlApi: string) =>
    `Não foi possível conectar ao board em ${urlApi}. Verifique se ele está rodando (npm run dev ou npm start) e se BOARD_API_URL aponta para ele.`,
  tempoEsgotado: (segundos: number) =>
    `O board não respondeu em ${segundos} s. A operação pode ter sido gravada: leia o item antes de repetir.`,
  erroApi: (status: number, codigo: string, mensagem: string) =>
    `Erro ${status} (${codigo}): ${mensagem}`.trim(),
  argumentosInvalidos: (detalhes: string) =>
    `Argumentos inválidos: ${detalhes}`,
  caminhoRelativo: 'Informe o caminho absoluto do arquivo.',
  arquivoLocalInexistente: (caminho: string) =>
    `Arquivo não encontrado ou sem permissão de leitura: ${caminho}`,
  arquivoLocalGrande: (caminho: string, limite: string) =>
    `O arquivo ${caminho} passa do limite de ${limite} por anexo.`,
  envioLocalGrande: (limite: string) =>
    `Os arquivos de um envio podem somar no máximo ${limite}. Envie em partes.`,
  imagemGrande: (tamanho: string) =>
    `A imagem (${tamanho}) é grande demais para ser exibida aqui. Abra-a pelo board.`,
  arquivoSemVisualizacao: (tipoConteudo: string, tamanho: string) =>
    `Arquivo ${tipoConteudo} de ${tamanho}: não pode ser exibido aqui. Abra-o pelo board.`,
  semConteudo: 'Operação concluída.',
} as const;
