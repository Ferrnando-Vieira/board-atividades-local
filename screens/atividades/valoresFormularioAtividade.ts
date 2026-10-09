import { PRIORIDADE } from '@/config/constantes';
import { gerarChaveNormalizada } from '@/util/NormalizacaoUtils';
import type { DetalheAtividade } from '@/servidor/atividades/consultasAtividades';

export type ValoresIniciaisAtividade = {
  titulo: string;
  descricao: string;
  prioridade: string;
  statusId: string;
  solicitante: string;
  tags: string[];
  prazoData: string;
  prazoHora: string;
  concluidaEmData: string;
  concluidaEmHora: string;
};

export function montarValoresNovaAtividade(
  statusId: number,
  solicitantePadrao: string | null,
): ValoresIniciaisAtividade {
  return {
    titulo: '',
    descricao: '',
    prioridade: String(PRIORIDADE.PADRAO),
    statusId: String(statusId),
    solicitante: solicitantePadrao ?? '',
    tags: [],
    prazoData: '',
    prazoHora: '',
    concluidaEmData: '',
    concluidaEmHora: '',
  };
}

export function montarValoresEdicaoAtividade(
  atividade: DetalheAtividade,
): ValoresIniciaisAtividade {
  return {
    titulo: atividade.titulo,
    descricao: atividade.descricao ?? '',
    prioridade: String(atividade.prioridade),
    statusId: String(atividade.status.id),
    solicitante: atividade.solicitante,
    tags: atividade.tags.map((tag) => tag.nome),
    prazoData: atividade.prazoData ?? '',
    prazoHora: atividade.prazoHora ?? '',
    concluidaEmData: atividade.concluidaEmData ?? '',
    concluidaEmHora: atividade.concluidaEmHora ?? '',
  };
}

export type SolicitanteSugerido = {
  nome: string;
  // Tag de onde veio o nome; nula quando é o padrão do board.
  tag: string | null;
};

// Mesma regra do servidor para o campo em branco: o solicitante padrão da
// primeira tag (na ordem em que foram adicionadas) que tiver um e, sem isso,
// o padrão do board.
export function sugerirSolicitante(
  tags: readonly string[],
  solicitantesPadraoTags: Readonly<Record<string, string>>,
  solicitantePadrao: string | null,
): SolicitanteSugerido {
  for (const tag of tags) {
    const nome = solicitantesPadraoTags[gerarChaveNormalizada(tag)];
    if (nome) {
      return { nome, tag };
    }
  }
  return { nome: solicitantePadrao ?? '', tag: null };
}
