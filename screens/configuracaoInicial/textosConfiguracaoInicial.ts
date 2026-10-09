export const textosConfiguracaoInicial = {
  titulo: 'Configuração inicial',
  descricao:
    'Crie a conta administrativa e defina o solicitante padrão deste board. O código de configuração é exibido no terminal do servidor por "npm run inicializar" (ou "npm run admin:codigo").',
  rotuloCodigo: 'Código de configuração',
  dicaCodigo: 'Formato XXXX-XXXX-XXXX-XXXX. Vale por tempo limitado.',
  rotuloUsuario: 'Usuário administrativo',
  dicaUsuario:
    'Letras minúsculas sem acento, números, ponto, hífen ou sublinhado.',
  rotuloSenha: 'Senha',
  rotuloConfirmacaoSenha: 'Confirme a senha',
  rotuloSolicitantePadrao: 'Solicitante padrão',
  dicaSolicitantePadrao:
    'Nome usado quando uma atividade é criada sem informar o solicitante, normalmente o seu. Pode ser trocado depois em Solicitantes.',
  botaoConcluir: 'Concluir configuração',
  botaoConcluindo: 'Criando…',
  avisoTitulo: 'Instalação incompleta',
  avisos: {
    'banco-ausente':
      'O banco de dados ainda não existe. No servidor, execute "npm run inicializar".',
    'migracoes-pendentes':
      'O banco de dados tem migrações pendentes. No servidor, execute "npm run inicializar".',
    'board-ausente':
      'O board ainda não foi criado. No servidor, execute "npm run inicializar".',
  },
} as const;

export function montarDicaSenha(tamanhoMinimo: number): string {
  return `Pelo menos ${tamanhoMinimo} caracteres. Prefira uma frase longa e exclusiva.`;
}
