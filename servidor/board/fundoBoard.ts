import { eq } from 'drizzle-orm';
import path from 'node:path';
import { z } from 'zod';
import { CAMPOS_FUNDO } from '@/config/camposFormulario';
import { VALOR_CAMPO_MARCADO } from '@/config/constantes';
import {
  CHAVES_FUNDO_BOARD,
  ehChaveFundoBoard,
  FORMATO_COR_HEXADECIMAL,
  FORMATOS_GRADIENTE,
  FUNDO_BOARD_PADRAO,
  GRADIENTE_PERSONALIZADO_PADRAO,
  LIMITES_GRADIENTE,
  LIMITES_IMAGEM_FUNDO,
  montarEstiloFundoBoard,
  montarEstiloGradientePersonalizado,
  montarEstiloImagemFundo,
  obterFormatoImagemFundo,
  TIPO_CONTEUDO_IMAGEM_FUNDO,
  type ChaveFundoBoard,
  type EstiloFundoBoard,
  type FormatoImagemFundo,
  type GradientePersonalizado,
  type TipoFundoBoard,
} from '@/config/fundosBoard';
import { montarRotaImagemFundo } from '@/config/rotas';
import {
  abrirConteudoAnexo,
  apagarConteudoAnexo,
  gerarIdentificadorArquivo,
  gravarConteudoAnexo,
  type ConteudoAnexo,
} from '@/servidor/anexos/armazenamentoAnexos';
import {
  CODIGOS_ANEXO,
  validarArquivoAnexo,
} from '@/servidor/anexos/validacaoAnexos';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { aparenciasLink, fundosBoard } from '@/servidor/banco/esquema';
import {
  buscarBoardPadrao,
  exigirBoardPadrao,
} from '@/servidor/board/boardRepositorio';
import {
  ESCOPO_BOARD,
  type EscopoAparencia,
} from '@/servidor/board/escopoAparencia';
import { formatarTamanhoArquivo } from '@/util/ArquivoUtils';
import { agoraIso } from '@/util/DataUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

// As imagens de fundo ficam numa subpasta dos anexos: a mesma área privada,
// fora de public/, que a limpeza de anexos órfãos não percorre.
const SUBPASTA_FUNDOS = 'fundos';

export const mensagensFundo = {
  fundoInvalido: 'Escolha um dos fundos disponíveis.',
  fundoSalvo: 'Fundo atualizado.',
  gradienteSalvo: 'Gradiente aplicado ao fundo.',
  formatoInvalido: 'Escolha o tipo de gradiente: linear ou radial.',
  anguloInvalido: `Informe um ângulo inteiro de ${LIMITES_GRADIENTE.ANGULO_MINIMO} a ${LIMITES_GRADIENTE.ANGULO_MAXIMO} graus.`,
  corInvalida: 'Escolha uma cor válida (formato #rrggbb).',
  corrijaCampos: 'Corrija os campos destacados.',
  imagemAusente: 'Escolha uma imagem para enviar.',
  imagemGrande: `A imagem pode ter no máximo ${formatarTamanhoArquivo(LIMITES_IMAGEM_FUNDO.TAMANHO_MAXIMO_BYTES)}.`,
  imagemTipoInvalido: 'Envie uma imagem PNG, JPG ou WebP.',
  imagemSalva: 'Imagem aplicada ao fundo.',
  imagemRemovida: 'Imagem removida. O fundo voltou ao padrão.',
  semImagem: 'Não há imagem de fundo para remover.',
  aparenciaRestaurada:
    'Aparência restaurada: este link volta a seguir a aparência do board.',
  restaurarSoNoLink: 'Só um link com aparência própria pode ser restaurado.',
} as const;

export const CODIGO_SEM_IMAGEM_FUNDO = 'sem-imagem-de-fundo';

// Só chaves do catálogo passam: cor, gradiente, CSS ou URL digitados no
// envio são recusados aqui e, se escaparem, pelo CHECK do banco.
export const esquemaFundoBoard = z.object({
  fundo: z.enum(CHAVES_FUNDO_BOARD, { error: mensagensFundo.fundoInvalido }),
});

export type AlteracaoFundoBoard = z.output<typeof esquemaFundoBoard>;

export const esquemaCor = z.preprocess(
  (valor) => (typeof valor === 'string' ? valor.trim().toLowerCase() : valor),
  z
    .string({ error: mensagensFundo.corInvalida })
    .regex(FORMATO_COR_HEXADECIMAL, { error: mensagensFundo.corInvalida }),
);

// A cor intermediária é opcional: só vale com a caixa marcada, porque o campo
// de cor do navegador nunca chega vazio.
export const esquemaGradientePersonalizado = z
  .object({
    [CAMPOS_FUNDO.FORMATO]: z.enum(FORMATOS_GRADIENTE, {
      error: mensagensFundo.formatoInvalido,
    }),
    [CAMPOS_FUNDO.ANGULO]: z.coerce
      .number({ error: mensagensFundo.anguloInvalido })
      .int({ error: mensagensFundo.anguloInvalido })
      .min(LIMITES_GRADIENTE.ANGULO_MINIMO, {
        error: mensagensFundo.anguloInvalido,
      })
      .max(LIMITES_GRADIENTE.ANGULO_MAXIMO, {
        error: mensagensFundo.anguloInvalido,
      }),
    [CAMPOS_FUNDO.COR_INICIAL]: esquemaCor,
    [CAMPOS_FUNDO.USAR_COR_INTERMEDIARIA]: z
      .string()
      .optional()
      .transform((valor) => valor === VALOR_CAMPO_MARCADO),
    [CAMPOS_FUNDO.COR_INTERMEDIARIA]: z.string().optional(),
    [CAMPOS_FUNDO.COR_FINAL]: esquemaCor,
  })
  .transform((dados, contexto): GradientePersonalizado => {
    const intermediaria = esquemaCor.safeParse(
      dados[CAMPOS_FUNDO.COR_INTERMEDIARIA],
    );
    if (dados[CAMPOS_FUNDO.USAR_COR_INTERMEDIARIA] && !intermediaria.success) {
      contexto.addIssue({
        code: 'custom',
        message: mensagensFundo.corInvalida,
        path: [CAMPOS_FUNDO.COR_INTERMEDIARIA],
      });
      return z.NEVER;
    }
    return {
      formato: dados[CAMPOS_FUNDO.FORMATO],
      angulo: dados[CAMPOS_FUNDO.ANGULO],
      cores:
        dados[CAMPOS_FUNDO.USAR_COR_INTERMEDIARIA] && intermediaria.success
          ? [
              dados[CAMPOS_FUNDO.COR_INICIAL],
              intermediaria.data,
              dados[CAMPOS_FUNDO.COR_FINAL],
            ]
          : [dados[CAMPOS_FUNDO.COR_INICIAL], dados[CAMPOS_FUNDO.COR_FINAL]],
    };
  });

export type ImagemFundo = {
  identificadorArquivo: string;
  formato: FormatoImagemFundo;
  hash: string;
  // Cor média calculada no navegador ao enviar; serve só para escolher a cor
  // do texto sobre as colunas. Nula em imagens enviadas antes da 0004.
  corMedia: string | null;
};

export type ConfiguracaoFundo = {
  tipo: TipoFundoBoard;
  chavePredefinida: ChaveFundoBoard;
  gradiente: GradientePersonalizado;
  imagem: ImagemFundo | null;
};

export const CONFIGURACAO_FUNDO_PADRAO: ConfiguracaoFundo = {
  tipo: 'predefinido',
  chavePredefinida: FUNDO_BOARD_PADRAO,
  gradiente: GRADIENTE_PERSONALIZADO_PADRAO,
  imagem: null,
};

// Uma linha de aparência, do board ou de um link (as colunas são as mesmas).
export type LinhaAparencia = Omit<typeof fundosBoard.$inferSelect, 'boardId'>;

export type ValoresAparencia = Partial<
  Omit<typeof fundosBoard.$inferInsert, 'boardId' | 'atualizadoEm'>
>;

function lerLinhaBoard(
  executor: ExecutorBanco,
  boardId: number,
): LinhaAparencia | undefined {
  return executor
    .select()
    .from(fundosBoard)
    .where(eq(fundosBoard.boardId, boardId))
    .get();
}

function lerLinhaLink(
  executor: ExecutorBanco,
  linkId: number,
): LinhaAparencia | undefined {
  return executor
    .select()
    .from(aparenciasLink)
    .where(eq(aparenciasLink.linkId, linkId))
    .get();
}

// A linha que vale no escopo: a do link quando ele tem aparência própria;
// senão (e para o board) a do board.
export function lerLinhaAparencia(
  executor: ExecutorBanco,
  escopo: EscopoAparencia,
): LinhaAparencia | undefined {
  if (escopo.tipo === 'link') {
    const propria = lerLinhaLink(executor, escopo.linkId);
    if (propria) {
      return propria;
    }
  }
  const board = buscarBoardPadrao(executor);
  return board ? lerLinhaBoard(executor, board.id) : undefined;
}

export function possuiAparenciaPropria(
  executor: ExecutorBanco,
  linkId: number,
): boolean {
  return lerLinhaLink(executor, linkId) !== undefined;
}

// Só as colunas de aparência: a chave da linha de origem e o momento da
// gravação não são copiados.
function copiarValores(linha: LinhaAparencia): ValoresAparencia {
  const valores: Record<string, unknown> = { ...linha };
  delete valores.boardId;
  delete valores.linkId;
  delete valores.atualizadoEm;
  return valores as ValoresAparencia;
}

// Grava valores de aparência no escopo e devolve a imagem que a linha do
// escopo usava antes. Sem linha, a do board nasce com o fundo legado de
// `boards.fundo`; a de um link nasce como cópia da aparência do board, para
// que mudar só o fundo não troque as cores (e vice-versa).
export function gravarValoresAparencia(
  transacao: ExecutorBanco,
  escopo: EscopoAparencia,
  valores: ValoresAparencia,
): string | null {
  const board = exigirBoardPadrao(transacao);
  const alteracao = { ...valores, atualizadoEm: agoraIso() };
  const linhaBoard = lerLinhaBoard(transacao, board.id);
  const valoresIniciais: ValoresAparencia = {
    chavePredefinida: ehChaveFundoBoard(board.fundo)
      ? board.fundo
      : FUNDO_BOARD_PADRAO,
  };
  if (escopo.tipo === 'board') {
    transacao
      .insert(fundosBoard)
      .values({ ...valoresIniciais, ...alteracao, boardId: board.id })
      .onConflictDoUpdate({ target: fundosBoard.boardId, set: alteracao })
      .run();
    return linhaBoard?.imagemIdentificador ?? null;
  }
  const anterior = lerLinhaLink(transacao, escopo.linkId);
  const base = linhaBoard ? copiarValores(linhaBoard) : valoresIniciais;
  transacao
    .insert(aparenciasLink)
    .values({ ...base, ...alteracao, linkId: escopo.linkId })
    .onConflictDoUpdate({ target: aparenciasLink.linkId, set: alteracao })
    .run();
  return anterior?.imagemIdentificador ?? null;
}

function converterImagem(linha: LinhaAparencia): ImagemFundo | null {
  if (!linha.imagemIdentificador || !linha.imagemFormato || !linha.imagemHash) {
    return null;
  }
  return {
    identificadorArquivo: linha.imagemIdentificador,
    formato: linha.imagemFormato,
    hash: linha.imagemHash,
    corMedia: linha.imagemCorMedia,
  };
}

// Valores que deixem de valer (catálogo de outra versão do código, imagem
// sem arquivo) caem no padrão em vez de quebrar a tela.
function converterLinha(linha: LinhaAparencia): ConfiguracaoFundo {
  const imagem = converterImagem(linha);
  const cores = [
    linha.gradienteCorInicial,
    linha.gradienteCorIntermediaria,
    linha.gradienteCorFinal,
  ].filter((cor): cor is string => cor !== null);
  return {
    tipo: linha.tipo === 'imagem' && !imagem ? 'predefinido' : linha.tipo,
    chavePredefinida: ehChaveFundoBoard(linha.chavePredefinida)
      ? linha.chavePredefinida
      : FUNDO_BOARD_PADRAO,
    gradiente: {
      formato: linha.gradienteFormato,
      angulo: linha.gradienteAngulo,
      cores,
    },
    imagem,
  };
}

// Sem linha em `fundos_board` (board criado depois da migração 0003, por
// exemplo), vale a coluna legada `boards.fundo`, que nasce como "padrao".
export function consultarConfiguracaoFundo(
  executor: ExecutorBanco,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): ConfiguracaoFundo {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return CONFIGURACAO_FUNDO_PADRAO;
  }
  const linha = lerLinhaAparencia(executor, escopo);
  if (linha) {
    return converterLinha(linha);
  }
  return {
    ...CONFIGURACAO_FUNDO_PADRAO,
    chavePredefinida: ehChaveFundoBoard(board.fundo)
      ? board.fundo
      : FUNDO_BOARD_PADRAO,
  };
}

export function consultarFundoBoard(executor: ExecutorBanco): ChaveFundoBoard {
  return consultarConfiguracaoFundo(executor).chavePredefinida;
}

// O estilo é montado aqui, a partir de valores já conferidos; a imagem é
// servida por rota autenticada do próprio acesso (painel ou link).
export function montarEstiloFundoConfigurado(
  configuracao: ConfiguracaoFundo,
  prefixoRotas: string,
): EstiloFundoBoard | undefined {
  if (configuracao.tipo === 'imagem' && configuracao.imagem) {
    return montarEstiloImagemFundo(
      montarRotaImagemFundo(configuracao.imagem.hash, prefixoRotas),
    );
  }
  if (configuracao.tipo === 'gradiente') {
    return montarEstiloGradientePersonalizado(configuracao.gradiente);
  }
  return montarEstiloFundoBoard(configuracao.chavePredefinida);
}

const SEM_IMAGEM = {
  imagemIdentificador: null,
  imagemFormato: null,
  imagemHash: null,
  imagemCorMedia: null,
} as const;

type ValoresFundo = ValoresAparencia &
  Required<Pick<ValoresAparencia, 'imagemIdentificador'>>;

// Grava e devolve o identificador da imagem que o escopo deixou de usar, para
// o arquivo ser apagado só depois de a transação gravar (e só se nenhum
// outro escopo ainda o usar; ver descartarArquivoImagem).
function gravarFundo(
  banco: BancoDados,
  valores: ValoresFundo,
  escopo: EscopoAparencia,
): string | null {
  return banco.transaction((transacao) => {
    const imagemAnterior = gravarValoresAparencia(transacao, escopo, valores);
    return imagemAnterior !== valores.imagemIdentificador
      ? imagemAnterior
      : null;
  }, TRANSACAO_ESCRITA);
}

export function resolverDiretorioFundos(diretorioAnexos: string): string {
  return path.join(diretorioAnexos, SUBPASTA_FUNDOS);
}

// O mesmo arquivo pode estar no board e em links que copiaram a aparência
// dele: só sai do disco quando nenhuma linha o usa mais.
function imagemEmUso(
  executor: ExecutorBanco,
  identificadorArquivo: string,
): boolean {
  const noBoard = executor
    .select({ boardId: fundosBoard.boardId })
    .from(fundosBoard)
    .where(eq(fundosBoard.imagemIdentificador, identificadorArquivo))
    .get();
  const emLink = executor
    .select({ linkId: aparenciasLink.linkId })
    .from(aparenciasLink)
    .where(eq(aparenciasLink.imagemIdentificador, identificadorArquivo))
    .get();
  return noBoard !== undefined || emLink !== undefined;
}

// A configuração já foi gravada; se o arquivo antigo não puder ser apagado
// agora, ele só ocupa espaço: nada mais o referencia nem o serve.
function descartarArquivoImagem(
  banco: BancoDados,
  diretorioAnexos: string,
  identificadorArquivo: string | null,
): void {
  if (
    identificadorArquivo === null ||
    imagemEmUso(banco, identificadorArquivo)
  ) {
    return;
  }
  try {
    apagarConteudoAnexo(
      resolverDiretorioFundos(diretorioAnexos),
      identificadorArquivo,
    );
  } catch {
    // Mantido em disco como sobra inofensiva (ver comentário acima).
  }
}

// Ajuste visual de valor único (do board, pelo proprietário, ou do próprio
// link): não usa versão, para não conflitar com a configuração de nome e
// fuso do board. Trocar de fundo descarta a imagem enviada, que só existe
// enquanto é o fundo em uso.
export function alterarFundoBoard(
  banco: BancoDados,
  alteracao: AlteracaoFundoBoard,
  diretorioAnexos?: string,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): void {
  const descartada = gravarFundo(
    banco,
    {
      tipo: 'predefinido',
      chavePredefinida: alteracao.fundo,
      ...SEM_IMAGEM,
    },
    escopo,
  );
  if (diretorioAnexos !== undefined) {
    descartarArquivoImagem(banco, diretorioAnexos, descartada);
  }
}

export function salvarGradientePersonalizado(
  banco: BancoDados,
  gradiente: GradientePersonalizado,
  diretorioAnexos?: string,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): void {
  const [inicial, ...demais] = gradiente.cores;
  const final = demais.at(-1);
  if (inicial === undefined || final === undefined) {
    throw new ErroApp(mensagensFundo.corInvalida, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: 'gradiente-invalido',
    });
  }
  const descartada = gravarFundo(
    banco,
    {
      tipo: 'gradiente',
      gradienteFormato: gradiente.formato,
      gradienteAngulo: gradiente.angulo,
      gradienteCorInicial: inicial,
      gradienteCorIntermediaria: demais.length > 1 ? (demais[0] ?? null) : null,
      gradienteCorFinal: final,
      ...SEM_IMAGEM,
    },
    escopo,
  );
  if (diretorioAnexos !== undefined) {
    descartarArquivoImagem(banco, diretorioAnexos, descartada);
  }
}

type ImagemValidada = {
  formato: FormatoImagemFundo;
  hash: string;
};

// Reaproveita a validação dos anexos (nome, extensão, assinatura dos bytes e
// hash) e restringe a PNG, JPEG e WebP com limite próprio.
export function validarImagemFundo(
  nomeArquivo: string,
  conteudo: Uint8Array,
): ImagemValidada {
  if (conteudo.byteLength > LIMITES_IMAGEM_FUNDO.TAMANHO_MAXIMO_BYTES) {
    throw new ErroApp(mensagensFundo.imagemGrande, {
      status: STATUS_ERRO.CORPO_GRANDE_DEMAIS,
      codigo: CODIGOS_ANEXO.ARQUIVO_GRANDE,
    });
  }
  const arquivo = validarArquivoAnexo(nomeArquivo, conteudo);
  const formato = obterFormatoImagemFundo(arquivo.tipoConteudo);
  if (formato === null) {
    throw new ErroApp(mensagensFundo.imagemTipoInvalido, {
      status: STATUS_ERRO.TIPO_NAO_SUPORTADO,
      codigo: CODIGOS_ANEXO.TIPO_NAO_PERMITIDO,
    });
  }
  return { formato, hash: arquivo.hashSha256 };
}

export type EnvioImagemFundo = {
  nomeArquivo: string;
  conteudo: Uint8Array;
  corMedia?: string | null;
};

// A cor média vem do navegador e é só um palpite para o contraste: valor fora
// do formato é descartado (fica o cálculo de pior caso) em vez de recusar a
// imagem.
function lerCorMedia(corMedia: string | null | undefined): string | null {
  const validacao = esquemaCor.safeParse(corMedia);
  return validacao.success ? validacao.data : null;
}

// O arquivo vai para o disco antes do banco (com fsync); se a gravação no
// banco falhar, ele é apagado. A imagem anterior só sai depois do sucesso.
export function salvarImagemFundo(
  banco: BancoDados,
  diretorioAnexos: string,
  envio: EnvioImagemFundo,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): void {
  const imagem = validarImagemFundo(envio.nomeArquivo, envio.conteudo);
  const diretorioFundos = resolverDiretorioFundos(diretorioAnexos);
  const identificadorArquivo = gerarIdentificadorArquivo();
  gravarConteudoAnexo(diretorioFundos, identificadorArquivo, envio.conteudo);
  let descartada: string | null;
  try {
    descartada = gravarFundo(
      banco,
      {
        tipo: 'imagem',
        imagemIdentificador: identificadorArquivo,
        imagemFormato: imagem.formato,
        imagemHash: imagem.hash,
        imagemCorMedia: lerCorMedia(envio.corMedia),
      },
      escopo,
    );
  } catch (erro) {
    apagarConteudoAnexo(diretorioFundos, identificadorArquivo);
    throw erro;
  }
  descartarArquivoImagem(banco, diretorioAnexos, descartada);
}

export function removerImagemFundo(
  banco: BancoDados,
  diretorioAnexos: string,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): void {
  const configuracao = consultarConfiguracaoFundo(banco, escopo);
  if (!configuracao.imagem) {
    throw new ErroApp(mensagensFundo.semImagem, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGO_SEM_IMAGEM_FUNDO,
    });
  }
  const descartada = gravarFundo(
    banco,
    {
      tipo: 'predefinido',
      chavePredefinida: FUNDO_BOARD_PADRAO,
      ...SEM_IMAGEM,
    },
    escopo,
  );
  descartarArquivoImagem(banco, diretorioAnexos, descartada);
}

// O link volta a seguir a aparência do board: a linha própria sai, e a
// imagem que só ele usava é apagada.
export function restaurarAparenciaDoBoard(
  banco: BancoDados,
  diretorioAnexos: string,
  linkId: number,
): void {
  const removida = banco.transaction(
    (transacao) =>
      transacao
        .delete(aparenciasLink)
        .where(eq(aparenciasLink.linkId, linkId))
        .returning({ imagemIdentificador: aparenciasLink.imagemIdentificador })
        .get(),
    TRANSACAO_ESCRITA,
  );
  descartarArquivoImagem(
    banco,
    diretorioAnexos,
    removida?.imagemIdentificador ?? null,
  );
}

export type ArquivoImagemFundo = {
  conteudo: ConteudoAnexo;
  tipoConteudo: string;
  hash: string;
};

// Só a imagem em uso é servida: sem fundo de imagem ativo, a rota responde
// como se não existisse.
export function abrirImagemFundo(
  executor: ExecutorBanco,
  diretorioAnexos: string,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): ArquivoImagemFundo | null {
  const configuracao = consultarConfiguracaoFundo(executor, escopo);
  if (configuracao.tipo !== 'imagem' || !configuracao.imagem) {
    return null;
  }
  const conteudo = abrirConteudoAnexo(
    resolverDiretorioFundos(diretorioAnexos),
    configuracao.imagem.identificadorArquivo,
  );
  return conteudo
    ? {
        conteudo,
        tipoConteudo: TIPO_CONTEUDO_IMAGEM_FUNDO[configuracao.imagem.formato],
        hash: configuracao.imagem.hash,
      }
    : null;
}
