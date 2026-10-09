// Os nomes dos campos são os mesmos das chaves dos esquemas Zod, para que os
// erros por campo devolvidos pelo servidor apontem para o campo certo na tela.
export const CAMPOS_ATIVIDADE = {
  ATIVIDADE_ID: 'atividadeId',
  VERSAO: 'versaoEsperada',
  TITULO: 'titulo',
  DESCRICAO: 'descricao',
  PRIORIDADE: 'prioridade',
  STATUS: 'statusId',
  SOLICITANTE: 'solicitante',
  TAGS: 'tags',
  PRAZO_DATA: 'prazoData',
  PRAZO_HORA: 'prazoHora',
  CONCLUSAO_DATA: 'concluidaEmData',
  CONCLUSAO_HORA: 'concluidaEmHora',
  RETORNO: 'retorno',
  // Arquivos guardados na tela até salvar: anexos escolhidos na criação e
  // imagens coladas na descrição. Cada arquivo vem com a chave na mesma
  // posição; a chave é a da referência "anexo-novo:" na descrição, ou vazia
  // para um anexo comum.
  ARQUIVOS: 'arquivos',
  CHAVES_ARQUIVOS: 'chavesArquivos',
  // Quantidade de anexos escolhidos, só para a tela perceber o rascunho
  // alterado; o servidor não lê este campo.
  RESUMO_ARQUIVOS: 'resumoArquivos',
} as const;

// Para onde a restauração leva depois de concluída: a lista de arquivadas
// continua aberta para restaurar várias em sequência.
export const RETORNOS_RESTAURACAO = {
  ARQUIVADAS: 'arquivadas',
  DETALHE: 'detalhe',
} as const;

export type RetornoRestauracao =
  (typeof RETORNOS_RESTAURACAO)[keyof typeof RETORNOS_RESTAURACAO];

export const CAMPOS_STATUS = {
  STATUS_ID: 'statusId',
  VERSAO: 'versaoEsperada',
  NOME: 'nome',
  FINALIZA: 'finalizaAtividade',
  COR_TITULO: 'corTitulo',
  COR_COLUNA: 'corColuna',
  DESTINO: 'statusDestinoId',
} as const;

export const CAMPOS_SOLICITANTE = {
  NOME: 'nome',
} as const;

export const CAMPOS_TAG = {
  TAG_ID: 'tagId',
  NOME_ATUAL: 'nomeAtual',
  NOME: 'nome',
  COR: 'cor',
  SOLICITANTE_PADRAO: 'solicitantePadrao',
} as const;

// Formulários de gestão abertos por um link completo levam o token do link:
// a Server Action não tem outra forma de saber qual link fez o envio, e o
// servidor valida o token a cada chamada (revogação vale na hora).
export const CAMPOS_ACESSO = {
  TOKEN_COMPARTILHAMENTO: 'tokenCompartilhamento',
} as const;

export const CAMPOS_COMPARTILHAMENTO = {
  LINK_ID: 'linkId',
  NOME: 'nome',
  MODALIDADE: 'modalidade',
  TAGS: 'tagIds',
  SOLICITANTES: 'solicitanteIds',
  INCLUIR_ARQUIVADAS: 'incluirArquivadas',
  VALIDADE: 'validadeDias',
  ANIMAL: 'animal',
} as const;

export const CAMPOS_TOKEN_API = {
  TOKEN_ID: 'tokenId',
  NOME: 'nome',
  PERMISSOES: 'permissoes',
  VALIDADE: 'validadeDias',
} as const;

export const CAMPOS_ANEXO = {
  ATIVIDADE_ID: 'atividadeId',
  ANEXO_ID: 'anexoId',
  ARQUIVO: 'arquivo',
} as const;

// Data e hora do lembrete são locais (fuso do board), como no prazo; o
// servidor converte para o instante em UTC que é gravado.
export const CAMPOS_LEMBRETE = {
  ATIVIDADE_ID: 'atividadeId',
  VERSAO: 'versaoEsperada',
  DATA: 'lembreteData',
  HORA: 'lembreteHora',
  ATIVO: 'ativo',
} as const;

export const CAMPOS_LEMBRETE_AVULSO = {
  LEMBRETE_ID: 'lembreteId',
  VERSAO: 'versaoEsperada',
  TITULO: 'titulo',
  OBSERVACAO: 'observacao',
  DATA: 'lembreteData',
  HORA: 'lembreteHora',
} as const;

export const CAMPOS_FUNDO = {
  FUNDO: 'fundo',
  FORMATO: 'formato',
  ANGULO: 'angulo',
  COR_INICIAL: 'corInicial',
  USAR_COR_INTERMEDIARIA: 'usarCorIntermediaria',
  COR_INTERMEDIARIA: 'corIntermediaria',
  COR_FINAL: 'corFinal',
  IMAGEM: 'imagem',
  COR_MEDIA_IMAGEM: 'corMediaImagem',
} as const;

export const CAMPOS_SUPERFICIES = {
  COR_TITULOS: 'corTitulos',
  COR_COLUNAS: 'corColunas',
  OPACIDADE_TITULOS: 'opacidadeTitulos',
  OPACIDADE_COLUNAS: 'opacidadeColunas',
  TOM_TEXTO: 'tomTexto',
} as const;

export const CAMPOS_PRIORIDADES = {
  critica: 'corPrioridadeCritica',
  alta: 'corPrioridadeAlta',
  media: 'corPrioridadeMedia',
  baixa: 'corPrioridadeBaixa',
} as const;
