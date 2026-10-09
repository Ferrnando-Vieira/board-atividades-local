import { and, eq, gt, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { SESSAO_ADMINISTRATIVA } from '@/config/constantesSeguranca';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import {
  administrador,
  sessoesAdministrativas,
} from '@/servidor/banco/esquema';
import {
  calcularHashToken,
  gerarTokenSeguro,
} from '@/servidor/seguranca/tokens';
import { calcularExpiracaoSessao } from '@/servidor/administracao/expiracaoSessao';
import { somarMinutos } from '@/util/DataUtils';

const TAMANHO_MAXIMO_TOKEN = 128;

export type SessaoCriada = {
  token: string;
  expiraEm: string;
};

export type SessaoValida = {
  sessaoId: number;
  administradorId: number;
  usuario: string;
  expiraEm: string;
};

export function criarSessao(
  executor: ExecutorBanco,
  administradorId: number,
  agora: Date,
): SessaoCriada {
  const token = gerarTokenSeguro();
  const expiraEm = calcularExpiracaoSessao(agora);
  executor
    .insert(sessoesAdministrativas)
    .values({
      administradorId,
      hashToken: calcularHashToken(token),
      expiraEm,
      ultimoUsoEm: agora.toISOString(),
    })
    .run();
  return { token, expiraEm };
}

// Registra o uso e renova a validade (no máximo uma escrita a cada
// INTERVALO_REGISTRO_USO_MINUTOS). Devolve a validade em vigor.
function renovarSessaoSeNecessario(
  executor: ExecutorBanco,
  sessaoId: number,
  ultimoUsoEm: string,
  expiraEm: string,
  agora: Date,
): string {
  const limiteSemRegistro = somarMinutos(
    agora,
    -SESSAO_ADMINISTRATIVA.INTERVALO_REGISTRO_USO_MINUTOS,
  ).toISOString();
  if (ultimoUsoEm > limiteSemRegistro) {
    return expiraEm;
  }
  const novaExpiracao = calcularExpiracaoSessao(agora);
  executor
    .update(sessoesAdministrativas)
    .set({ ultimoUsoEm: agora.toISOString(), expiraEm: novaExpiracao })
    .where(eq(sessoesAdministrativas.id, sessaoId))
    .run();
  return novaExpiracao;
}

export function validarSessao(
  executor: ExecutorBanco,
  token: string | undefined,
  agora: Date = new Date(),
): SessaoValida | null {
  if (!token || token.length > TAMANHO_MAXIMO_TOKEN) {
    return null;
  }
  const sessao = executor
    .select({
      sessaoId: sessoesAdministrativas.id,
      administradorId: sessoesAdministrativas.administradorId,
      usuario: administrador.usuario,
      expiraEm: sessoesAdministrativas.expiraEm,
      ultimoUsoEm: sessoesAdministrativas.ultimoUsoEm,
    })
    .from(sessoesAdministrativas)
    .innerJoin(
      administrador,
      eq(administrador.id, sessoesAdministrativas.administradorId),
    )
    .where(
      and(
        eq(sessoesAdministrativas.hashToken, calcularHashToken(token)),
        isNull(sessoesAdministrativas.revogadaEm),
        gt(sessoesAdministrativas.expiraEm, agora.toISOString()),
      ),
    )
    .get();
  if (!sessao) {
    return null;
  }
  const expiraEm = renovarSessaoSeNecessario(
    executor,
    sessao.sessaoId,
    sessao.ultimoUsoEm,
    sessao.expiraEm,
    agora,
  );
  return {
    sessaoId: sessao.sessaoId,
    administradorId: sessao.administradorId,
    usuario: sessao.usuario,
    expiraEm,
  };
}

export function revogarSessao(
  executor: ExecutorBanco,
  token: string,
  agora: Date = new Date(),
): void {
  executor
    .update(sessoesAdministrativas)
    .set({ revogadaEm: agora.toISOString() })
    .where(
      and(
        eq(sessoesAdministrativas.hashToken, calcularHashToken(token)),
        isNull(sessoesAdministrativas.revogadaEm),
      ),
    )
    .run();
}

export function removerSessoesEncerradas(
  executor: ExecutorBanco,
  agora: Date,
): void {
  executor
    .delete(sessoesAdministrativas)
    .where(
      or(
        lte(sessoesAdministrativas.expiraEm, agora.toISOString()),
        isNotNull(sessoesAdministrativas.revogadaEm),
      ),
    )
    .run();
}
