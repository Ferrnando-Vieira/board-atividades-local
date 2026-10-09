import { LIMITES_CORPO_API } from '@/servidor/api/limitesApi';

export const CODIGOS_ERRO_API = {
  TOKEN_AUSENTE: 'token-ausente',
  TOKEN_INVALIDO: 'token-invalido',
  PERMISSAO_INSUFICIENTE: 'permissao-insuficiente',
  DADOS_INVALIDOS: 'dados-invalidos',
  JSON_INVALIDO: 'json-invalido',
  TIPO_CONTEUDO: 'tipo-conteudo-nao-suportado',
  MULTIPART_INVALIDO: 'multipart-invalido',
  CORPO_GRANDE: 'corpo-grande-demais',
  PARAMETRO_DESCONHECIDO: 'parametro-desconhecido',
  ROTA_INEXISTENTE: 'rota-inexistente',
  METODO_NAO_PERMITIDO: 'metodo-nao-permitido',
  RECURSO_INEXISTENTE: 'recurso-inexistente',
  INSTALACAO_INCOMPLETA: 'instalacao-incompleta',
  ERRO_INTERNO: 'erro-interno',
} as const;

export const mensagensApi = {
  tokenAusente:
    'Envie o token de API no cabeçalho "Authorization: Bearer <token>".',
  tokenInvalido:
    'Token de API inválido, expirado ou revogado. Peça um novo token ao proprietário do board.',
  permissaoInsuficiente: (permissoes: readonly string[]) =>
    `Este token não tem a permissão necessária: ${permissoes.join(', ')}.`,
  dadosInvalidos: 'Os dados enviados são inválidos. Veja os campos indicados.',
  jsonInvalido: 'O corpo da requisição precisa ser um objeto JSON válido.',
  tipoConteudo: 'Envie o corpo com "Content-Type: application/json".',
  tipoConteudoArquivos:
    'Envie os arquivos com "Content-Type: multipart/form-data", um campo "arquivo" para cada um.',
  multipartInvalido:
    'O corpo multipart/form-data está malformado. Envie cada arquivo no campo "arquivo".',
  campoDesconhecido: (nomes: readonly string[]) =>
    `Campo desconhecido no envio: ${nomes.join(', ')}. Use apenas "arquivo".`,
  corpoGrande: `O corpo da requisição passa do limite de ${LIMITES_CORPO_API.BYTES_MAXIMOS / 1024} KiB.`,
  parametroDesconhecido: (nomes: readonly string[]) =>
    `Parâmetro de consulta desconhecido: ${nomes.join(', ')}.`,
  parametroRepetido: (nome: string) =>
    `O parâmetro de consulta "${nome}" só pode aparecer uma vez.`,
  rotaInexistente: 'Endpoint inexistente. Consulte GET /api/v1.',
  metodoNaoPermitido: (permitidos: readonly string[]) =>
    `Método não permitido neste endpoint. Use: ${permitidos.join(', ')}.`,
  recursoInexistente: 'Recurso não encontrado.',
  instalacaoIncompleta:
    'O board ainda não está pronto: no servidor, execute "npm run inicializar".',
  erroInterno:
    'Erro interno ao processar a requisição. Verifique os registros do servidor.',
  nenhumCampo: 'Informe ao menos um campo para alterar além de versaoEsperada.',
} as const;
