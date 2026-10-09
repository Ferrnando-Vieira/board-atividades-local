import { count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  CAMPOS_HISTORICO,
  HISTORICO,
  type TipoEventoHistorico,
  type TipoOrigemAlteracao,
} from '@/config/constantes';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import { historicoAtividades } from '@/servidor/banco/esquema';
import type { AlteracaoHistorico } from '@/servidor/historico/historicoRepositorio';

export type EventoHistorico = {
  id: number;
  tipo: TipoEventoHistorico;
  origem: TipoOrigemAlteracao;
  autor: string | null;
  ocorridoEm: string;
  alteracoes: AlteracaoHistorico[];
};

export type ConsultaHistorico = {
  eventos: EventoHistorico[];
  total: number;
};

const esquemaAlteracoes = z.array(
  z.object({
    campo: z.enum(CAMPOS_HISTORICO),
    antes: z.string().nullable(),
    depois: z.string().nullable(),
  }),
);

// O CHECK garante uma lista JSON; um item fora do formato atual (gravado por
// uma versão futura, por exemplo) não derruba o detalhe: o evento aparece sem
// a lista de campos.
function lerAlteracoes(texto: string): AlteracaoHistorico[] {
  try {
    const resultado = esquemaAlteracoes.safeParse(JSON.parse(texto));
    return resultado.success ? resultado.data : [];
  } catch {
    return [];
  }
}

// Quem chama já conferiu que a atividade está no escopo do acesso. Mais
// recentes primeiro; no mesmo instante, a ordem de gravação.
export function consultarHistoricoAtividade(
  executor: ExecutorBanco,
  atividadeId: number,
  limite: number = HISTORICO.MAXIMO_EVENTOS_EXIBIDOS,
): ConsultaHistorico {
  const filtro = eq(historicoAtividades.atividadeId, atividadeId);
  const eventos = executor
    .select()
    .from(historicoAtividades)
    .where(filtro)
    .orderBy(desc(historicoAtividades.ocorridoEm), desc(historicoAtividades.id))
    .limit(limite)
    .all()
    .map((linha) => ({
      id: linha.id,
      tipo: linha.tipo,
      origem: linha.origem,
      autor: linha.autor,
      ocorridoEm: linha.ocorridoEm,
      alteracoes: lerAlteracoes(linha.alteracoes),
    }));
  const total =
    executor
      .select({ quantidade: count() })
      .from(historicoAtividades)
      .where(filtro)
      .get()?.quantidade ?? 0;
  return { eventos, total };
}
