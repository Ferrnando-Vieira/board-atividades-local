import { and, count, eq, isNull } from 'drizzle-orm';
import { ehImagemExibivel, LIMITES_ANEXO } from '@/config/anexos';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { anexos, atividades } from '@/servidor/banco/esquema';
import {
  apagarConteudoAnexo,
  gerarIdentificadorArquivo,
  gravarConteudoAnexo,
  listarArquivosArmazenados,
} from '@/servidor/anexos/armazenamentoAnexos';
import {
  COLUNAS_RESUMO_ANEXO,
  type AnexoResumo,
} from '@/servidor/anexos/consultasAnexos';
import { mensagensAnexos } from '@/servidor/anexos/mensagensAnexos';
import {
  CODIGOS_ANEXO,
  validarArquivoAnexo,
  type ArquivoAnexoValidado,
} from '@/servidor/anexos/validacaoAnexos';
import {
  CODIGO_ATIVIDADE_INEXISTENTE,
  exigirAtividadeAtiva,
} from '@/servidor/atividades/atividadesRepositorio';
import {
  montarCondicaoFiltro,
  type RestricaoLeitura,
} from '@/servidor/atividades/filtrosAtividades';
import { mensagensAtividades } from '@/servidor/atividades/mensagensAtividades';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';
import { registrarEventoHistorico } from '@/servidor/historico/historicoRepositorio';
import {
  ORIGEM_SISTEMA,
  type OrigemAlteracao,
} from '@/servidor/historico/origemAlteracao';
import { somarMinutos } from '@/util/DataUtils';
import { ehChaveAnexoNovo } from '@/util/DescricaoUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

export type EnvioAnexo = {
  atividadeId: number;
  nomeArquivo: string;
  conteudo: Uint8Array;
};

// Arquivo que chegou com um formulário e ainda não foi gravado. `chave` liga
// a imagem colada à referência "anexo-novo:CHAVE" da descrição; nula para um
// anexo comum.
export type ArquivoPendente = {
  nomeArquivo: string;
  conteudo: Uint8Array;
  chave: string | null;
};

export type ArquivosPendentes = {
  diretorioAnexos: string;
  arquivos: readonly ArquivoPendente[];
};

export type EnvioAnexos = {
  atividadeId: number;
  arquivos: readonly ArquivoPendente[];
};

// Já validado e gravado em disco, à espera do metadado.
export type ArquivoPreparado = ArquivoAnexoValidado & {
  identificadorArquivo: string;
  chave: string | null;
};

export type AnexoVinculado = AnexoResumo & { chave: string | null };

export type RemocaoAnexo = {
  atividadeId: number;
  anexoId: number;
};

export type ResultadoReconciliacaoAnexos = {
  arquivosVerificados: number;
  orfaosRemovidos: number;
};

// Fora do escopo do acesso a atividade responde como inexistente, antes de
// qualquer outra regra: a resposta não revela se ela existe ou está arquivada.
function exigirAtividadeDoAcesso(
  executor: ExecutorBanco,
  atividadeId: number,
  restricao: RestricaoLeitura,
) {
  const board = exigirBoardPadrao(executor);
  const visivel = executor
    .select({ id: atividades.id })
    .from(atividades)
    .where(
      and(
        eq(atividades.id, atividadeId),
        eq(atividades.boardId, board.id),
        montarCondicaoFiltro(restricao),
      ),
    )
    .get();
  if (!visivel) {
    throw new ErroApp(mensagensAtividades.atividadeInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGO_ATIVIDADE_INEXISTENTE,
    });
  }
  return exigirAtividadeAtiva(executor, board.id, atividadeId);
}

function contarAnexosAtivos(
  executor: ExecutorBanco,
  atividadeId: number,
): number {
  return (
    executor
      .select({ quantidade: count() })
      .from(anexos)
      .where(
        and(eq(anexos.atividadeId, atividadeId), isNull(anexos.removidoEm)),
      )
      .get()?.quantidade ?? 0
  );
}

function exigirEspacoParaAnexos(
  executor: ExecutorBanco,
  atividadeId: number,
  quantidade: number,
): void {
  if (
    contarAnexosAtivos(executor, atividadeId) + quantidade >
    LIMITES_ANEXO.MAXIMO_POR_ATIVIDADE
  ) {
    throw new ErroApp(mensagensAnexos.limiteAnexos, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGOS_ANEXO.LIMITE_ANEXOS,
    });
  }
}

function exigirDestinoDosAnexos(
  executor: ExecutorBanco,
  atividadeId: number,
  restricao: RestricaoLeitura,
  quantidade: number,
): void {
  exigirAtividadeDoAcesso(executor, atividadeId, restricao);
  exigirEspacoParaAnexos(executor, atividadeId, quantidade);
}

// A remoção lógica já está gravada; um arquivo que não puder ser apagado
// agora fica para a reconciliação, sem desfazer a operação do usuário.
function descartarArquivoSemFalhar(
  diretorioAnexos: string,
  identificadorArquivo: string,
): void {
  try {
    apagarConteudoAnexo(diretorioAnexos, identificadorArquivo);
  } catch {
    // reconciliarArquivosAnexos remove o arquivo numa próxima execução.
  }
}

function erroDadosInvalidos(): ErroApp {
  return new ErroApp(mensagensAnexos.dadosInvalidos, {
    status: STATUS_ERRO.REQUISICAO_INVALIDA,
    codigo: CODIGOS_ANEXO.REFERENCIA_INVALIDA,
  });
}

function exigirLimitesDoEnvio(arquivos: readonly ArquivoPendente[]): void {
  if (arquivos.length === 0) {
    throw new ErroApp(mensagensAnexos.arquivoAusente, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ANEXO.ARQUIVO_AUSENTE,
    });
  }
  if (arquivos.length > LIMITES_ANEXO.MAXIMO_POR_ENVIO) {
    throw new ErroApp(mensagensAnexos.arquivosDemais, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ANEXO.ARQUIVOS_DEMAIS,
    });
  }
  const total = arquivos.reduce(
    (soma, arquivo) => soma + arquivo.conteudo.byteLength,
    0,
  );
  if (total > LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES) {
    throw new ErroApp(mensagensAnexos.envioGrande, {
      status: STATUS_ERRO.CORPO_GRANDE_DEMAIS,
      codigo: CODIGOS_ANEXO.ENVIO_GRANDE,
    });
  }
  const chaves = arquivos.flatMap((arquivo) =>
    arquivo.chave === null ? [] : [arquivo.chave],
  );
  if (
    chaves.some((chave) => !ehChaveAnexoNovo(chave)) ||
    new Set(chaves).size !== chaves.length
  ) {
    throw erroDadosInvalidos();
  }
}

// Cada arquivo passa pela mesma validação do envio avulso (tamanho, nome,
// extensão e assinatura). Imagem colada na descrição precisa, além disso, ser
// uma imagem que a página exibe.
function validarArquivosPendentes(
  arquivos: readonly ArquivoPendente[],
): Array<
  ArquivoAnexoValidado & { chave: string | null; conteudo: Uint8Array }
> {
  exigirLimitesDoEnvio(arquivos);
  return arquivos.map((arquivo) => {
    const validado = validarArquivoAnexo(arquivo.nomeArquivo, arquivo.conteudo);
    if (arquivo.chave !== null && !ehImagemExibivel(validado.tipoConteudo)) {
      throw new ErroApp(mensagensAnexos.imagemNaoPermitida, {
        status: STATUS_ERRO.TIPO_NAO_SUPORTADO,
        codigo: CODIGOS_ANEXO.IMAGEM_NAO_PERMITIDA,
      });
    }
    return { ...validado, chave: arquivo.chave, conteudo: arquivo.conteudo };
  });
}

function descartarArquivosPreparados(
  diretorioAnexos: string,
  preparados: readonly ArquivoPreparado[],
): void {
  for (const preparado of preparados) {
    descartarArquivoSemFalhar(diretorioAnexos, preparado.identificadorArquivo);
  }
}

// Valida todos os arquivos antes de gravar o primeiro e os grava em disco com
// nome interno aleatório. Depois, `gravar` abre a transação que insere os
// metadados (vincularArquivosPreparados). Se a validação, a gravação em disco
// ou a transação falharem, os arquivos já gravados são apagados: não sobra
// arquivo sem metadado nem metadado sem arquivo, e nada do envio fica pela
// metade.
export function executarComArquivosPendentes<T>(
  pendentes: ArquivosPendentes | null,
  gravar: (preparados: readonly ArquivoPreparado[]) => T,
): T {
  if (pendentes === null || pendentes.arquivos.length === 0) {
    return gravar([]);
  }
  const validados = validarArquivosPendentes(pendentes.arquivos);
  const preparados: ArquivoPreparado[] = [];
  try {
    for (const { conteudo, ...validado } of validados) {
      const identificadorArquivo = gerarIdentificadorArquivo();
      gravarConteudoAnexo(
        pendentes.diretorioAnexos,
        identificadorArquivo,
        conteudo,
      );
      preparados.push({ ...validado, identificadorArquivo });
    }
    return gravar(preparados);
  } catch (erro) {
    descartarArquivosPreparados(pendentes.diretorioAnexos, preparados);
    throw erro;
  }
}

// Dentro da transação de quem chama (envio avulso, criação ou edição da
// atividade): confere o limite por atividade, grava os metadados e um evento
// de histórico por arquivo.
export function vincularArquivosPreparados(
  executor: ExecutorBanco,
  atividadeId: number,
  preparados: readonly ArquivoPreparado[],
  origem: OrigemAlteracao,
  agora: Date,
): AnexoVinculado[] {
  if (preparados.length === 0) {
    return [];
  }
  exigirEspacoParaAnexos(executor, atividadeId, preparados.length);
  return preparados.map((preparado) => {
    const anexo = executor
      .insert(anexos)
      .values({
        atividadeId,
        identificadorArquivo: preparado.identificadorArquivo,
        nomeOriginal: preparado.nomeOriginal,
        tipoConteudo: preparado.tipoConteudo,
        tamanhoBytes: preparado.tamanhoBytes,
        hashSha256: preparado.hashSha256,
        criadoEm: agora.toISOString(),
      })
      .returning(COLUNAS_RESUMO_ANEXO)
      .get();
    registrarEventoHistorico(executor, {
      atividadeId,
      tipo: 'anexo-adicionado',
      origem,
      alteracoes: [{ campo: 'anexo', antes: null, depois: anexo.nomeOriginal }],
      agora,
    });
    return { ...anexo, chave: preparado.chave };
  });
}

export function mapearAnexosPorChave(
  vinculados: readonly AnexoVinculado[],
): Map<string, number> {
  return new Map(
    vinculados.flatMap((anexo) =>
      anexo.chave === null ? [] : [[anexo.chave, anexo.id] as const],
    ),
  );
}

// Envio pela seção de anexos: um ou vários arquivos, tudo ou nada. A
// conferência do destino antes da gravação evita escrever em disco o que
// seria recusado; a da transação é a que vale.
export function anexarArquivos(
  banco: BancoDados,
  diretorioAnexos: string,
  envio: EnvioAnexos,
  restricao: RestricaoLeitura = null,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
): AnexoResumo[] {
  exigirDestinoDosAnexos(
    banco,
    envio.atividadeId,
    restricao,
    envio.arquivos.length,
  );
  // Aqui o envio sem arquivo é erro (no formulário da atividade, é só um
  // envio sem anexos).
  exigirLimitesDoEnvio(envio.arquivos);
  const vinculados = executarComArquivosPendentes(
    { diretorioAnexos, arquivos: envio.arquivos },
    (preparados) =>
      banco.transaction((transacao) => {
        exigirDestinoDosAnexos(
          transacao,
          envio.atividadeId,
          restricao,
          preparados.length,
        );
        return vincularArquivosPreparados(
          transacao,
          envio.atividadeId,
          preparados,
          origem,
          agora,
        );
      }, TRANSACAO_ESCRITA),
  );
  return vinculados.map((anexo) => ({
    id: anexo.id,
    nomeOriginal: anexo.nomeOriginal,
    tipoConteudo: anexo.tipoConteudo,
    tamanhoBytes: anexo.tamanhoBytes,
    criadoEm: anexo.criadoEm,
  }));
}

export function anexarArquivo(
  banco: BancoDados,
  diretorioAnexos: string,
  envio: EnvioAnexo,
  restricao: RestricaoLeitura = null,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
): AnexoResumo {
  const [anexo] = anexarArquivos(
    banco,
    diretorioAnexos,
    {
      atividadeId: envio.atividadeId,
      arquivos: [
        {
          nomeArquivo: envio.nomeArquivo,
          conteudo: envio.conteudo,
          chave: null,
        },
      ],
    },
    restricao,
    agora,
    origem,
  );
  if (!anexo) {
    throw new Error('O envio de um arquivo não devolveu o anexo gravado.');
  }
  return anexo;
}

export function removerAnexo(
  banco: BancoDados,
  diretorioAnexos: string,
  remocao: RemocaoAnexo,
  restricao: RestricaoLeitura = null,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
): void {
  const identificadorArquivo = banco.transaction((transacao) => {
    exigirAtividadeDoAcesso(transacao, remocao.atividadeId, restricao);
    const anexo = transacao
      .select({
        id: anexos.id,
        identificadorArquivo: anexos.identificadorArquivo,
        nomeOriginal: anexos.nomeOriginal,
      })
      .from(anexos)
      .where(
        and(
          eq(anexos.id, remocao.anexoId),
          eq(anexos.atividadeId, remocao.atividadeId),
          isNull(anexos.removidoEm),
        ),
      )
      .get();
    if (!anexo) {
      throw new ErroApp(mensagensAnexos.anexoInexistente, {
        status: STATUS_ERRO.NAO_ENCONTRADO,
        codigo: CODIGOS_ANEXO.ANEXO_INEXISTENTE,
      });
    }
    transacao
      .update(anexos)
      .set({ removidoEm: agora.toISOString() })
      .where(eq(anexos.id, anexo.id))
      .run();
    registrarEventoHistorico(transacao, {
      atividadeId: remocao.atividadeId,
      tipo: 'anexo-removido',
      origem,
      alteracoes: [{ campo: 'anexo', antes: anexo.nomeOriginal, depois: null }],
      agora,
    });
    return anexo.identificadorArquivo;
  }, TRANSACAO_ESCRITA);
  descartarArquivoSemFalhar(diretorioAnexos, identificadorArquivo);
}

// Apaga do diretório privado os arquivos sem anexo ativo: sobras de um envio
// interrompido entre a gravação do arquivo e a do metadado, ou de uma remoção
// cujo arquivo não pôde ser apagado na hora. Arquivos recentes ficam, porque
// podem pertencer a um envio em andamento.
export function reconciliarArquivosAnexos(
  executor: ExecutorBanco,
  diretorioAnexos: string,
  agora: Date = new Date(),
): ResultadoReconciliacaoAnexos {
  const limiteModificacao = somarMinutos(
    agora,
    -LIMITES_ANEXO.IDADE_MINIMA_ORFAO_MINUTOS,
  ).getTime();
  const arquivos = listarArquivosArmazenados(diretorioAnexos);
  const identificadoresAtivos = new Set(
    executor
      .select({ identificadorArquivo: anexos.identificadorArquivo })
      .from(anexos)
      .where(isNull(anexos.removidoEm))
      .all()
      .map((linha) => linha.identificadorArquivo),
  );
  const orfaos = arquivos.filter(
    (arquivo) =>
      !identificadoresAtivos.has(arquivo.identificadorArquivo) &&
      arquivo.modificadoEm.getTime() <= limiteModificacao,
  );
  const orfaosRemovidos = orfaos.filter((arquivo) =>
    apagarConteudoAnexo(diretorioAnexos, arquivo.identificadorArquivo),
  ).length;
  return { arquivosVerificados: arquivos.length, orfaosRemovidos };
}
