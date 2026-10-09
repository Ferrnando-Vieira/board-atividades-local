export const textosPresenca = {
  tituloPainel: 'Neste board agora',
  proprietario: 'Proprietário do board',
  voce: 'Você',
  vocePrefixo: 'Você aparece como',
  porLink: 'Pelo link compartilhado',
  descreverBotao: (quantidade: number) =>
    quantidade === 1
      ? '1 outra pessoa está vendo o board'
      : `${quantidade} outras pessoas estão vendo o board`,
  sozinhoComo: (apelido: string) => `Você está vendo o board como ${apelido}`,
  maisPessoas: (quantidade: number) => `+${quantidade}`,
  entrou: (nome: string) => `${nome} entrou no board.`,
  explicacao:
    'Quem abre o board por um link nomeado aparece com o nome do link; pelo link padrão, com um animal anônimo. A lista se atualiza a cada poucos segundos.',
  sessaoEncerrada:
    'Sua sessão expirou. Entre novamente para continuar; o que estiver na tela não será salvo até lá.',
  entrarNovamente: 'Entrar novamente',
  linkIndisponivel: 'Este link de compartilhamento não está mais disponível.',
  recarregar: 'Recarregar',
} as const;
