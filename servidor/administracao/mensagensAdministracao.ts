import {
  SENHA_ADMINISTRADOR,
  USUARIO_ADMINISTRADOR,
} from '@/config/constantesSeguranca';

export const mensagensAdministracao = {
  configuracaoJaConcluida:
    'A configuração inicial já foi concluída. Entre com a conta administrativa.',
  codigoAusente:
    'Nenhum código de configuração ativo. Gere um no servidor com "npm run admin:codigo".',
  codigoExpirado:
    'O código de configuração expirou. Gere outro no servidor com "npm run admin:codigo".',
  codigoBloqueado:
    'O código foi invalidado após tentativas incorretas. Gere outro no servidor com "npm run admin:codigo".',
  codigoInvalido: 'Código de configuração incorreto.',
  codigoObrigatorio: 'Informe o código exibido no terminal do servidor.',
  usuarioInvalido: `O usuário deve ter de ${USUARIO_ADMINISTRADOR.TAMANHO_MINIMO} a ${USUARIO_ADMINISTRADOR.TAMANHO_MAXIMO} caracteres: letras minúsculas sem acento, números, ponto, hífen ou sublinhado.`,
  senhaCurta: `A senha deve ter pelo menos ${SENHA_ADMINISTRADOR.TAMANHO_MINIMO} caracteres.`,
  senhaLonga: `A senha pode ter no máximo ${SENHA_ADMINISTRADOR.TAMANHO_MAXIMO} caracteres.`,
  senhasDiferentes: 'A confirmação não confere com a senha.',
  credenciaisInvalidas: 'Usuário ou senha incorretos.',
  acessoBloqueado:
    'Muitas tentativas incorretas. O acesso foi bloqueado temporariamente; tente novamente mais tarde.',
  configuracaoPendente:
    'A configuração inicial ainda não foi concluída neste servidor.',
} as const;
