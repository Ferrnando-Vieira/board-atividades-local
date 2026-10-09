import { eq, sql } from 'drizzle-orm';
import { BLOQUEIO_LOGIN } from '@/config/constantesSeguranca';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { administrador, ID_REGISTRO_UNICO } from '@/servidor/banco/esquema';
import type { DadosEntrada } from '@/servidor/administracao/esquemasAdministracao';
import {
  criarSessao,
  removerSessoesEncerradas,
  type SessaoCriada,
} from '@/servidor/administracao/sessoes';
import {
  gerarHashSenha,
  precisaRecalcularHash,
  verificarSenha,
} from '@/servidor/seguranca/senha';
import { calcularHashToken, hashesIguais } from '@/servidor/seguranca/tokens';
import { somarMinutos } from '@/util/DataUtils';

export type MotivoFalhaAutenticacao =
  'configuracao-pendente' | 'bloqueado' | 'credenciais-invalidas';

export type ResultadoAutenticacao =
  | ({ autenticado: true } & SessaoCriada)
  | { autenticado: false; motivo: MotivoFalhaAutenticacao };

function buscarAdministrador(executor: ExecutorBanco) {
  return executor
    .select()
    .from(administrador)
    .where(eq(administrador.id, ID_REGISTRO_UNICO))
    .get();
}

// Compara hashes de tamanho fixo para que o tempo de resposta não revele
// quantos caracteres do usuário estavam corretos.
function usuarioConfere(informado: string, cadastrado: string): boolean {
  return hashesIguais(
    calcularHashToken(informado),
    calcularHashToken(cadastrado),
  );
}

function registrarFalha(
  banco: BancoDados,
  agora: Date,
): MotivoFalhaAutenticacao {
  return banco.transaction(
    (transacao) => {
      const atualizado = transacao
        .update(administrador)
        .set({ tentativasFalhas: sql`${administrador.tentativasFalhas} + 1` })
        .where(eq(administrador.id, ID_REGISTRO_UNICO))
        .returning({ tentativas: administrador.tentativasFalhas })
        .get();
      if (
        !atualizado ||
        atualizado.tentativas < BLOQUEIO_LOGIN.TENTATIVAS_MAXIMAS
      ) {
        return 'credenciais-invalidas';
      }
      transacao
        .update(administrador)
        .set({
          tentativasFalhas: 0,
          bloqueadoAte: somarMinutos(
            agora,
            BLOQUEIO_LOGIN.DURACAO_MINUTOS,
          ).toISOString(),
        })
        .where(eq(administrador.id, ID_REGISTRO_UNICO))
        .run();
      return 'bloqueado';
    },
    { behavior: 'immediate' },
  );
}

export async function autenticarAdministrador(
  banco: BancoDados,
  dados: DadosEntrada,
  agora: Date = new Date(),
): Promise<ResultadoAutenticacao> {
  const cadastro = buscarAdministrador(banco);
  if (!cadastro) {
    return { autenticado: false, motivo: 'configuracao-pendente' };
  }
  if (cadastro.bloqueadoAte && cadastro.bloqueadoAte > agora.toISOString()) {
    return { autenticado: false, motivo: 'bloqueado' };
  }
  const senhaConfere = await verificarSenha(dados.senha, cadastro.hashSenha);
  if (!senhaConfere || !usuarioConfere(dados.usuario, cadastro.usuario)) {
    return { autenticado: false, motivo: registrarFalha(banco, agora) };
  }
  const hashAtualizado = precisaRecalcularHash(cadastro.hashSenha)
    ? await gerarHashSenha(dados.senha)
    : undefined;
  const sessao = banco.transaction(
    (transacao) => {
      transacao
        .update(administrador)
        .set({
          tentativasFalhas: 0,
          bloqueadoAte: null,
          ...(hashAtualizado ? { hashSenha: hashAtualizado } : {}),
        })
        .where(eq(administrador.id, ID_REGISTRO_UNICO))
        .run();
      removerSessoesEncerradas(transacao, agora);
      return criarSessao(transacao, cadastro.id, agora);
    },
    { behavior: 'immediate' },
  );
  return { autenticado: true, ...sessao };
}
