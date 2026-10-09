import type { PermissaoApi } from '@/config/constantes';
import { PREFIXO_API } from '@/config/rotas';

export const METODOS_API = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type MetodoApi = (typeof METODOS_API)[number];

export type EndpointApi = {
  metodo: MetodoApi;
  caminho: string;
  permissoes: readonly PermissaoApi[];
  descricao: string;
};

// Fonte única: cada rota exige exatamente as permissões daqui, e o índice
// GET /api/v1, a tela de integrações e os testes leem a mesma lista.
export const ENDPOINTS_API = {
  indice: {
    metodo: 'GET',
    caminho: PREFIXO_API,
    permissoes: [],
    descricao:
      'Índice: identifica o token em uso, as permissões dele e lista estes endpoints.',
  },
  lerBoard: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/board`,
    permissoes: ['board:ler'],
    descricao: 'Board, fuso horário, status em ordem e totais de atividades.',
  },
  listarAtividades: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/atividades`,
    permissoes: ['atividades:ler'],
    descricao:
      'Lista na ordem do quadro. Filtros: status (id), tag (nome), solicitante (nome) — OU dentro de cada um, E entre eles —, busca e situacao=ativas|arquivadas|todas.',
  },
  criarAtividade: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/atividades`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Cria na coluna statusId (opcional: a primeira), na posição da ordem automática (prioridade, depois criação). Solicitante omitido ou em branco: o padrão da primeira tag (na ordem enviada) que tiver um; senão, o padrão do board. Tags e solicitante novos são cadastrados normalizados.',
  },
  lerAtividade: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/atividades/{id}`,
    permissoes: ['atividades:ler'],
    descricao: 'Detalhe de uma atividade, ativa ou arquivada.',
  },
  atualizarAtividade: {
    metodo: 'PATCH',
    caminho: `${PREFIXO_API}/atividades/{id}`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Altera só os campos enviados. A ordem na coluna é automática: para subir um card, use uma prioridade menor (0 = mais alta). Trocar statusId leva à nova coluna na ordem automática. Exige versaoEsperada.',
  },
  moverAtividade: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/atividades/{id}/mover`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Move para statusId, na posição da ordem automática; status que conclui grava a conclusão. posicao é aceita por compatibilidade e não altera a ordem. Exige versaoEsperada.',
  },
  arquivarAtividade: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/atividades/{id}/arquivar`,
    permissoes: ['atividades:escrever'],
    descricao: 'Arquiva (nada é apagado). Exige versaoEsperada.',
  },
  desarquivarAtividade: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/atividades/{id}/desarquivar`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Restaura no status de antes, na posição da ordem automática. Exige versaoEsperada.',
  },
  lerHistoricoAtividade: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/atividades/{id}/historico`,
    permissoes: ['atividades:ler'],
    descricao:
      'Histórico de alterações da atividade, mais recentes primeiro (até 200 eventos), com o total: tipo, origem, autor e campos com o valor antes e depois.',
  },
  listarAnexos: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/atividades/{id}/anexos`,
    permissoes: ['anexos:ler'],
    descricao:
      'Anexos da atividade (ativa ou arquivada), na ordem de envio. Imagens PNG, JPG, GIF e WebP trazem "markdown" (![nome](anexo:ID)) para usar na descrição.',
  },
  enviarAnexos: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/atividades/{id}/anexos`,
    permissoes: ['anexos:escrever'],
    descricao:
      'Envia de 1 a 10 arquivos em multipart/form-data (campo "arquivo"): até 10 MiB cada, 25 MiB no total e 30 anexos por atividade; tudo ou nada. Não altera a versão da atividade.',
  },
  lerAnexo: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/atividades/{id}/anexos/{anexoId}`,
    permissoes: ['anexos:ler'],
    descricao:
      'Conteúdo do anexo, com o tipo conferido no envio e Content-Disposition attachment.',
  },
  removerAnexo: {
    metodo: 'DELETE',
    caminho: `${PREFIXO_API}/atividades/{id}/anexos/{anexoId}`,
    permissoes: ['anexos:escrever'],
    descricao:
      'Remove o anexo. Imagem citada na descrição passa a aparecer como indisponível.',
  },
  definirLembreteAtividade: {
    metodo: 'PUT',
    caminho: `${PREFIXO_API}/atividades/{id}/lembrete`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Define ou remarca o lembrete da atividade: lembreteData + lembreteHora, no fuso do board e no futuro; volta a pendente. Exige versaoEsperada.',
  },
  desativarLembreteAtividade: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/atividades/{id}/lembrete/desativar`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Desativa o lembrete da atividade (situacao cancelado). Lembrete já disparado não pode ser desativado. Exige versaoEsperada.',
  },
  reativarLembreteAtividade: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/atividades/{id}/lembrete/reativar`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Reativa o lembrete desativado cujo horário ainda é futuro; se já passou, remarque com PUT. Exige versaoEsperada.',
  },
  excluirLembreteAtividade: {
    metodo: 'DELETE',
    caminho: `${PREFIXO_API}/atividades/{id}/lembrete`,
    permissoes: ['atividades:escrever'],
    descricao: 'Remove o lembrete da atividade. Consulta: versaoEsperada.',
  },
  listarLembretes: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/lembretes`,
    permissoes: ['atividades:ler'],
    descricao:
      'Lembretes avulsos (sem atividade): pendentes por horário, depois disparados e desativados. Filtro opcional: situacao=pendente|disparado|cancelado.',
  },
  criarLembrete: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/lembretes`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Cria lembrete avulso: titulo, observacao opcional e lembreteData + lembreteHora, no fuso do board e no futuro.',
  },
  lerLembrete: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/lembretes/{id}`,
    permissoes: ['atividades:ler'],
    descricao: 'Detalhe de um lembrete avulso.',
  },
  atualizarLembrete: {
    metodo: 'PATCH',
    caminho: `${PREFIXO_API}/lembretes/{id}`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Altera só os campos enviados e remarca: o lembrete volta a pendente no horário resultante, que precisa ser futuro. Exige versaoEsperada.',
  },
  desativarLembrete: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/lembretes/{id}/desativar`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Desativa (situacao cancelado): não dispara até ser reativado. Lembrete já disparado não pode ser desativado. Exige versaoEsperada.',
  },
  reativarLembrete: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/lembretes/{id}/reativar`,
    permissoes: ['atividades:escrever'],
    descricao:
      'Reativa um lembrete desativado cujo horário ainda é futuro; se já passou, remarque com PATCH. Exige versaoEsperada.',
  },
  excluirLembrete: {
    metodo: 'DELETE',
    caminho: `${PREFIXO_API}/lembretes/{id}`,
    permissoes: ['atividades:escrever'],
    descricao: 'Exclui o lembrete avulso. Consulta: versaoEsperada.',
  },
  listarStatus: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/status`,
    permissoes: ['board:ler'],
    descricao: 'Status (colunas) em ordem, com contagens.',
  },
  criarStatus: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/status`,
    permissoes: ['board:escrever'],
    descricao:
      'Cria status no fim do quadro; corTitulo e corColuna opcionais ("#rrggbb" ou null = cores globais).',
  },
  atualizarStatus: {
    metodo: 'PATCH',
    caminho: `${PREFIXO_API}/status/{id}`,
    permissoes: ['board:escrever'],
    descricao:
      'Renomeia, marca se o status conclui atividades e/ou muda corTitulo e corColuna. Exige versaoEsperada.',
  },
  moverStatus: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/status/{id}/mover`,
    permissoes: ['board:escrever'],
    descricao: 'Muda a posição da coluna (0 = primeira).',
  },
  excluirStatus: {
    metodo: 'DELETE',
    caminho: `${PREFIXO_API}/status/{id}`,
    permissoes: ['board:escrever'],
    descricao:
      'Exclui; com atividades exige statusDestinoId, que as recebe. Consulta: versaoEsperada e statusDestinoId.',
  },
  listarTags: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/tags`,
    permissoes: ['board:ler'],
    descricao:
      'Tags em ordem alfabética, com a quantidade de atividades e o solicitantePadrao (null = a tag não define).',
  },
  criarTag: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/tags`,
    permissoes: ['board:escrever'],
    descricao:
      'Cria tag (nome normalizado e único); cor opcional "#rrggbb" (null = neutra) e solicitantePadrao opcional.',
  },
  editarTag: {
    metodo: 'PATCH',
    caminho: `${PREFIXO_API}/tags/{id}`,
    permissoes: ['board:escrever'],
    descricao:
      'Renomeia, muda a cor (null = neutra) e/ou o solicitantePadrao (null remove); exige nomeAtual como condição de concorrência.',
  },
  excluirTag: {
    metodo: 'DELETE',
    caminho: `${PREFIXO_API}/tags/{id}`,
    permissoes: ['board:escrever'],
    descricao:
      'Exclui só a tag e os vínculos (as atividades ficam). Consulta: nomeAtual.',
  },
  listarSolicitantes: {
    metodo: 'GET',
    caminho: `${PREFIXO_API}/solicitantes`,
    permissoes: ['board:ler'],
    descricao:
      'Solicitantes cadastrados, com a quantidade de atividades; padrao=true marca o usado quando a atividade não informa solicitante.',
  },
  registrarSolicitante: {
    metodo: 'POST',
    caminho: `${PREFIXO_API}/solicitantes`,
    permissoes: ['board:escrever'],
    descricao:
      'Cadastra solicitante normalizado; se já existe, devolve o existente (200).',
  },
  definirSolicitantePadrao: {
    metodo: 'PUT',
    caminho: `${PREFIXO_API}/solicitantes/padrao`,
    permissoes: ['board:escrever'],
    descricao:
      'Define o solicitante padrão do board (nome novo é cadastrado), usado nas atividades salvas sem solicitante e sem tag que defina um.',
  },
} as const satisfies Record<string, EndpointApi>;

export const CATALOGO_API: readonly EndpointApi[] =
  Object.values(ENDPOINTS_API);

export const CAMPO_ARQUIVO_API = 'arquivo';
