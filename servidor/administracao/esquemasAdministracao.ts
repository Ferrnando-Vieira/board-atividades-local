import { z } from 'zod';
import {
  SENHA_ADMINISTRADOR,
  USUARIO_ADMINISTRADOR,
} from '@/config/constantesSeguranca';
import { mensagensAdministracao } from '@/servidor/administracao/mensagensAdministracao';
import { esquemaNomeSolicitante } from '@/servidor/classificacao/esquemasSolicitantes';

const esquemaUsuario = z
  .string()
  .trim()
  .toLowerCase()
  .min(USUARIO_ADMINISTRADOR.TAMANHO_MINIMO, {
    error: mensagensAdministracao.usuarioInvalido,
  })
  .max(USUARIO_ADMINISTRADOR.TAMANHO_MAXIMO, {
    error: mensagensAdministracao.usuarioInvalido,
  })
  .regex(USUARIO_ADMINISTRADOR.FORMATO, {
    error: mensagensAdministracao.usuarioInvalido,
  });

const esquemaSenhaNova = z
  .string()
  .min(SENHA_ADMINISTRADOR.TAMANHO_MINIMO, {
    error: mensagensAdministracao.senhaCurta,
  })
  .max(SENHA_ADMINISTRADOR.TAMANHO_MAXIMO, {
    error: mensagensAdministracao.senhaLonga,
  });

export const esquemaConfiguracaoInicial = z
  .object({
    codigo: z
      .string()
      .trim()
      .min(1, { error: mensagensAdministracao.codigoObrigatorio }),
    usuario: esquemaUsuario,
    senha: esquemaSenhaNova,
    confirmacaoSenha: z.string(),
    // Nome gravado quando uma atividade não informa o solicitante; cada
    // instalação define o seu, e ele pode ser trocado depois.
    solicitantePadrao: esquemaNomeSolicitante,
  })
  .refine((dados) => dados.senha === dados.confirmacaoSenha, {
    error: mensagensAdministracao.senhasDiferentes,
    path: ['confirmacaoSenha'],
  });

export type DadosConfiguracaoInicial = z.infer<
  typeof esquemaConfiguracaoInicial
>;

// Na entrada não se revela a política de senha: qualquer falha de formato
// recebe a mesma resposta genérica de credenciais inválidas.
export const esquemaEntrada = z.object({
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(USUARIO_ADMINISTRADOR.TAMANHO_MAXIMO),
  senha: z.string().min(1).max(SENHA_ADMINISTRADOR.TAMANHO_MAXIMO),
});

export type DadosEntrada = z.infer<typeof esquemaEntrada>;
