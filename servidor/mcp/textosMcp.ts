export const textosMcp = {
  titulo: 'Board de atividades',
  instrucoes:
    'Ferramentas para ler e alterar o board de atividades local pela API HTTP. Antes de alterar uma atividade ou um status, leia-o para obter a versão atual e envie-a em versaoEsperada; se receber conflito-de-versao, leia de novo e repita. Comece por identificar_token para ver as permissões do token em uso. Prioridade vai de 0 (mais alta) a 9 (mais baixa). Datas no formato aaaa-mm-dd e horas hh:mm, no fuso do board. Lembretes avulsos (sem atividade) têm ferramentas próprias e só aceitam data e hora futuras.',
  tokenAusente:
    'BOARD_API_TOKEN não configurado. Gere um token em Integrações no board e coloque BOARD_API_TOKEN=bat_… no arquivo .env.local do projeto (ou na variável de ambiente do servidor MCP).',
  boardIndisponivel: (urlApi: string) =>
    `Não foi possível conectar ao board em ${urlApi}. Verifique se ele está rodando (npm run dev ou npm start) e se BOARD_API_URL aponta para ele.`,
  erroApi: (status: number, codigo: string, mensagem: string) =>
    `Erro ${status} (${codigo}): ${mensagem}`.trim(),
  argumentosInvalidos: (detalhes: string) =>
    `Argumentos inválidos: ${detalhes}`,
  semConteudo: 'Operação concluída.',
} as const;
