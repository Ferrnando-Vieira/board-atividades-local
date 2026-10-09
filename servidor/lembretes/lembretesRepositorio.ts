import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import { atividades } from '@/servidor/banco/esquema';

export type LembretePendente = {
  atividadeId: number;
  titulo: string;
  lembreteEm: string;
};

// Só a situação 'pendente' é elegível: lembretes gravados como 'disparado'
// (histórico) nunca voltam a gerar notificação.
export function listarLembretesPendentes(
  executor: ExecutorBanco,
  ate: Date,
): LembretePendente[] {
  return executor
    .select({
      atividadeId: atividades.id,
      titulo: atividades.titulo,
      lembreteEm: atividades.lembreteEm,
    })
    .from(atividades)
    .where(
      and(
        eq(atividades.lembreteSituacao, 'pendente'),
        lte(atividades.lembreteEm, ate.toISOString()),
        isNull(atividades.arquivadaEm),
      ),
    )
    .orderBy(asc(atividades.lembreteEm))
    .all()
    .flatMap((linha) =>
      linha.lembreteEm === null
        ? []
        : [{ ...linha, lembreteEm: linha.lembreteEm }],
    );
}

// Próximos avisos de atividades (ainda pendentes e no futuro), para a lista
// "Próximos" da central e da página de lembretes.
export function listarProximosLembretesAtividades(
  executor: ExecutorBanco,
  depoisDe: Date,
  limite: number,
): LembretePendente[] {
  return executor
    .select({
      atividadeId: atividades.id,
      titulo: atividades.titulo,
      lembreteEm: atividades.lembreteEm,
    })
    .from(atividades)
    .where(
      and(
        eq(atividades.lembreteSituacao, 'pendente'),
        gt(atividades.lembreteEm, depoisDe.toISOString()),
        isNull(atividades.arquivadaEm),
      ),
    )
    .orderBy(asc(atividades.lembreteEm))
    .limit(limite)
    .all()
    .flatMap((linha) =>
      linha.lembreteEm === null
        ? []
        : [{ ...linha, lembreteEm: linha.lembreteEm }],
    );
}
