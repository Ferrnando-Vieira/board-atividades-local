import { eq } from 'drizzle-orm';
import type { CampoHistorico, TipoEventoHistorico } from '@/config/constantes';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import {
  atividades,
  atividadesTags,
  historicoAtividades,
  solicitantes,
  statusBoard,
  tags,
} from '@/servidor/banco/esquema';
import type { OrigemAlteracao } from '@/servidor/historico/origemAlteracao';

export type AlteracaoHistorico = {
  campo: CampoHistorico;
  antes: string | null;
  depois: string | null;
};

type CampoComparado = Exclude<CampoHistorico, 'anexo'>;

// Fotografia dos campos visíveis da atividade, com os nomes como a tela os
// mostra naquele momento. Prazo e conclusão juntam data e hora ("aaaa-mm-dd
// hh:mm"); tags vão em ordem alfabética, separadas por vírgula.
export type EstadoHistorico = Record<CampoComparado, string | null>;

const CAMPOS_COMPARADOS = [
  'titulo',
  'descricao',
  'prioridade',
  'status',
  'solicitante',
  'tags',
  'prazo',
  'conclusao',
] as const satisfies readonly CampoComparado[];

const SEPARADOR_TAGS = ', ';
const LOCALIDADE_ORDENACAO = 'pt-BR';

function juntarDataHora(
  data: string | null,
  hora: string | null,
): string | null {
  if (data === null) {
    return null;
  }
  return hora === null ? data : `${data} ${hora}`;
}

function listarNomesTagsDaAtividade(
  executor: ExecutorBanco,
  atividadeId: number,
): string[] {
  return executor
    .select({ nome: tags.nome })
    .from(atividadesTags)
    .innerJoin(tags, eq(tags.id, atividadesTags.tagId))
    .where(eq(atividadesTags.atividadeId, atividadeId))
    .all()
    .map((linha) => linha.nome)
    .sort((primeiro, segundo) =>
      primeiro.localeCompare(segundo, LOCALIDADE_ORDENACAO),
    );
}

export function capturarEstadoHistorico(
  executor: ExecutorBanco,
  atividadeId: number,
): EstadoHistorico {
  const linha = executor
    .select({
      titulo: atividades.titulo,
      descricao: atividades.descricao,
      prioridade: atividades.prioridade,
      status: statusBoard.nome,
      solicitante: solicitantes.nome,
      prazoData: atividades.prazoData,
      prazoHora: atividades.prazoHora,
      concluidaEmData: atividades.concluidaEmData,
      concluidaEmHora: atividades.concluidaEmHora,
    })
    .from(atividades)
    .innerJoin(statusBoard, eq(statusBoard.id, atividades.statusId))
    .innerJoin(solicitantes, eq(solicitantes.id, atividades.solicitanteId))
    .where(eq(atividades.id, atividadeId))
    .get();
  if (!linha) {
    throw new Error(
      `Atividade ${atividadeId} ausente ao registrar o histórico.`,
    );
  }
  const nomesTags = listarNomesTagsDaAtividade(executor, atividadeId);
  return {
    titulo: linha.titulo,
    descricao: linha.descricao,
    prioridade: String(linha.prioridade),
    status: linha.status,
    solicitante: linha.solicitante,
    tags: nomesTags.length > 0 ? nomesTags.join(SEPARADOR_TAGS) : null,
    prazo: juntarDataHora(linha.prazoData, linha.prazoHora),
    conclusao: juntarDataHora(linha.concluidaEmData, linha.concluidaEmHora),
  };
}

export function compararEstadosHistorico(
  antes: EstadoHistorico,
  depois: EstadoHistorico,
): AlteracaoHistorico[] {
  return CAMPOS_COMPARADOS.filter(
    (campo) => antes[campo] !== depois[campo],
  ).map((campo) => ({ campo, antes: antes[campo], depois: depois[campo] }));
}

export type EventoHistoricoNovo = {
  atividadeId: number;
  tipo: TipoEventoHistorico;
  origem: OrigemAlteracao;
  alteracoes?: readonly AlteracaoHistorico[];
  agora: Date;
};

// Sempre dentro da transação da própria operação: se ela for desfeita, o
// evento também é.
export function registrarEventoHistorico(
  executor: ExecutorBanco,
  evento: EventoHistoricoNovo,
): void {
  executor
    .insert(historicoAtividades)
    .values({
      atividadeId: evento.atividadeId,
      tipo: evento.tipo,
      origem: evento.origem.tipo,
      autor: evento.origem.autor,
      alteracoes: JSON.stringify(evento.alteracoes ?? []),
      ocorridoEm: evento.agora.toISOString(),
    })
    .run();
}

// Compara o estado gravado agora com o capturado antes da operação. Sem
// diferença visível (salvar sem mudar nada, reordenar na coluna), nada é
// gravado.
export function registrarAlteracoesAtividade(
  executor: ExecutorBanco,
  atividadeId: number,
  tipo: TipoEventoHistorico,
  antes: EstadoHistorico,
  origem: OrigemAlteracao,
  agora: Date,
): boolean {
  const alteracoes = compararEstadosHistorico(
    antes,
    capturarEstadoHistorico(executor, atividadeId),
  );
  if (alteracoes.length === 0) {
    return false;
  }
  registrarEventoHistorico(executor, {
    atividadeId,
    tipo,
    origem,
    alteracoes,
    agora,
  });
  return true;
}
