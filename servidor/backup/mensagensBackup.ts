export const CODIGOS_ERRO_BACKUP = {
  BANCO_AUSENTE: 'backup-banco-ausente',
  DESTINO_EXISTENTE: 'backup-destino-existente',
  ANEXO_INCONSISTENTE: 'backup-anexo-inconsistente',
  BACKUP_INVALIDO: 'backup-invalido',
  VERSAO_INCOMPATIVEL: 'backup-versao-incompativel',
  BANCO_EM_USO: 'backup-banco-em-uso',
} as const;

export const mensagensBackup = {
  bancoAusente: (caminho: string) =>
    `Banco não encontrado em ${caminho}. Confira CAMINHO_BANCO_SQLITE.`,
  destinoExistente: (caminho: string) =>
    `Já existe ${caminho}. Escolha outra pasta de destino.`,
  anexoInconsistente: (identificador: string) =>
    `O arquivo do anexo ${identificador} está ausente ou difere do registrado no banco. Pare o servidor e repita o backup.`,
  manifestoInvalido:
    'O manifesto do backup (manifesto-backup.json) está ausente ou inválido.',
  hashBancoDiferente:
    'O arquivo do banco no backup não corresponde ao manifesto: ele foi alterado ou está corrompido.',
  integridadeBanco: (resultado: string) =>
    `A verificação de integridade do banco do backup falhou: ${resultado}.`,
  chavesEstrangeiras: (quantidade: number) =>
    `O banco do backup tem ${quantidade} violação(ões) de chave estrangeira.`,
  migracoesDiferentes:
    'A quantidade de migrações do banco do backup não corresponde ao manifesto.',
  anexoDoBackup: (identificador: string) =>
    `O anexo ${identificador} está ausente no backup ou difere do registrado no banco.`,
  versaoIncompativel: (doBackup: number, disponiveis: number) =>
    `O backup tem ${doBackup} migrações e esta versão do board conhece só ${disponiveis}. Restaure com a versão do código que gerou o backup.`,
  bancoEmUso:
    'Não foi possível mover o banco atual: ele parece estar em uso. Pare o servidor (Ctrl+C no terminal do npm start/npm run dev) e repita.',
} as const;
