import { z } from 'zod';
import {
  LIMITES_OPACIDADE,
  MODOS_TOM_TEXTO,
  NIVEIS_PRIORIDADE,
  SUPERFICIES_PADRAO,
  type CoresPrioridade,
  type SuperficiesBoard,
} from '@/config/aparenciaBoard';
import {
  CAMPOS_PRIORIDADES,
  CAMPOS_SUPERFICIES,
} from '@/config/camposFormulario';
import {
  obterCoresFundoBoard,
  type EstiloFundoBoard,
} from '@/config/fundosBoard';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import {
  ESCOPO_BOARD,
  type EscopoAparencia,
} from '@/servidor/board/escopoAparencia';
import {
  consultarConfiguracaoFundo,
  esquemaCor,
  gravarValoresAparencia,
  lerLinhaAparencia,
  montarEstiloFundoConfigurado,
  type ConfiguracaoFundo,
  type LinhaAparencia,
  type ValoresAparencia,
} from '@/servidor/board/fundoBoard';
import {
  calcularAparenciaColuna,
  calcularTomFundo,
  montarVariaveisColuna,
  montarVariaveisPrioridade,
  resolverCoresPrioridade,
  type AparenciaColuna,
  type CoresPrioridadePersonalizadas,
  type VariaveisCss,
} from '@/util/AparenciaUtils';
import type { TomTexto } from '@/util/CorUtils';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

// Sem informação sobre a imagem, o contraste é calculado contra os dois
// extremos: a superfície precisa funcionar sobre qualquer região dela.
const AMOSTRAS_PIOR_CASO = ['#000000', '#ffffff'] as const;

export const mensagensAparencia = {
  corInvalida: 'Escolha uma cor válida (formato #rrggbb).',
  opacidadeInvalida: `Informe uma opacidade inteira de ${LIMITES_OPACIDADE.MINIMA} a ${LIMITES_OPACIDADE.MAXIMA}%.`,
  tomInvalido: 'Escolha automática, escura ou clara para a cor do texto.',
  corrijaCampos: 'Corrija os campos destacados.',
  superficiesSalvas: 'Cores e transparência das colunas aplicadas.',
  prioridadesSalvas: 'Cores das prioridades aplicadas.',
} as const;

export type AparenciaBoard = {
  superficies: SuperficiesBoard;
  prioridadesPersonalizadas: CoresPrioridadePersonalizadas;
  prioridades: CoresPrioridade;
};

const PRIORIDADES_SEM_PERSONALIZACAO: CoresPrioridadePersonalizadas = {
  critica: null,
  alta: null,
  media: null,
  baixa: null,
};

export const APARENCIA_PADRAO: AparenciaBoard = {
  superficies: SUPERFICIES_PADRAO,
  prioridadesPersonalizadas: PRIORIDADES_SEM_PERSONALIZACAO,
  prioridades: resolverCoresPrioridade(PRIORIDADES_SEM_PERSONALIZACAO),
};

function converterLinha(linha: LinhaAparencia): AparenciaBoard {
  const prioridadesPersonalizadas = {
    critica: linha.corPrioridadeCritica,
    alta: linha.corPrioridadeAlta,
    media: linha.corPrioridadeMedia,
    baixa: linha.corPrioridadeBaixa,
  };
  return {
    superficies: {
      corTitulos: linha.corTitulos,
      corColunas: linha.corColunas,
      opacidadeTitulos: linha.opacidadeTitulos,
      opacidadeColunas: linha.opacidadeColunas,
      tomTexto: linha.tomTexto,
    },
    prioridadesPersonalizadas,
    prioridades: resolverCoresPrioridade(prioridadesPersonalizadas),
  };
}

export function consultarAparenciaBoard(
  executor: ExecutorBanco,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): AparenciaBoard {
  const linha = lerLinhaAparencia(executor, escopo);
  return linha ? converterLinha(linha) : APARENCIA_PADRAO;
}

export function obterAmostrasFundo(configuracao: ConfiguracaoFundo): string[] {
  if (configuracao.tipo === 'imagem' && configuracao.imagem) {
    return configuracao.imagem.corMedia
      ? [configuracao.imagem.corMedia]
      : [...AMOSTRAS_PIOR_CASO];
  }
  if (configuracao.tipo === 'gradiente') {
    return [...configuracao.gradiente.cores];
  }
  return obterCoresFundoBoard(configuracao.chavePredefinida);
}

export type AparenciaPainel = {
  estiloFundo: EstiloFundoBoard | undefined;
  amostrasFundo: string[];
  tomFundo: TomTexto;
  superficies: SuperficiesBoard;
  colunaPadrao: AparenciaColuna;
  variaveis: VariaveisCss;
};

// Tudo o que o painel precisa para pintar fundo, colunas e prioridades no
// escopo do acesso (o board ou a aparência própria do link).
export function montarAparenciaPainel(
  executor: ExecutorBanco,
  prefixoRotas: string,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): AparenciaPainel {
  const configuracao = consultarConfiguracaoFundo(executor, escopo);
  const aparencia = consultarAparenciaBoard(executor, escopo);
  const amostrasFundo = obterAmostrasFundo(configuracao);
  const colunaPadrao = calcularAparenciaColuna(
    amostrasFundo,
    aparencia.superficies,
  );
  return {
    estiloFundo: montarEstiloFundoConfigurado(configuracao, prefixoRotas),
    amostrasFundo,
    tomFundo: calcularTomFundo(amostrasFundo),
    superficies: aparencia.superficies,
    colunaPadrao,
    variaveis: {
      ...montarVariaveisColuna(colunaPadrao),
      ...montarVariaveisPrioridade(aparencia.prioridades),
    },
  };
}

const esquemaOpacidade = z.coerce
  .number({ error: mensagensAparencia.opacidadeInvalida })
  .int({ error: mensagensAparencia.opacidadeInvalida })
  .min(LIMITES_OPACIDADE.MINIMA, {
    error: mensagensAparencia.opacidadeInvalida,
  })
  .max(LIMITES_OPACIDADE.MAXIMA, {
    error: mensagensAparencia.opacidadeInvalida,
  });

export const esquemaSuperficies = z
  .object({
    [CAMPOS_SUPERFICIES.COR_TITULOS]: esquemaCor,
    [CAMPOS_SUPERFICIES.COR_COLUNAS]: esquemaCor,
    [CAMPOS_SUPERFICIES.OPACIDADE_TITULOS]: esquemaOpacidade,
    [CAMPOS_SUPERFICIES.OPACIDADE_COLUNAS]: esquemaOpacidade,
    [CAMPOS_SUPERFICIES.TOM_TEXTO]: z.enum(MODOS_TOM_TEXTO, {
      error: mensagensAparencia.tomInvalido,
    }),
  })
  .transform((dados): SuperficiesBoard => ({
    corTitulos: dados[CAMPOS_SUPERFICIES.COR_TITULOS],
    corColunas: dados[CAMPOS_SUPERFICIES.COR_COLUNAS],
    opacidadeTitulos: dados[CAMPOS_SUPERFICIES.OPACIDADE_TITULOS],
    opacidadeColunas: dados[CAMPOS_SUPERFICIES.OPACIDADE_COLUNAS],
    tomTexto: dados[CAMPOS_SUPERFICIES.TOM_TEXTO],
  }));

export const esquemaCoresPrioridade = z
  .object({
    [CAMPOS_PRIORIDADES.critica]: esquemaCor,
    [CAMPOS_PRIORIDADES.alta]: esquemaCor,
    [CAMPOS_PRIORIDADES.media]: esquemaCor,
    [CAMPOS_PRIORIDADES.baixa]: esquemaCor,
  })
  .transform(
    (dados): CoresPrioridade =>
      Object.fromEntries(
        NIVEIS_PRIORIDADE.map((nivel) => [
          nivel,
          dados[CAMPOS_PRIORIDADES[nivel]],
        ]),
      ) as CoresPrioridade,
  );

// Ajuste visual de valor único (como o fundo): sem controle de versão. Sem
// linha no escopo, ela nasce com o fundo atual (ver gravarValoresAparencia)
// para não trocar o fundo de quem só mexeu nas cores.
function gravarAparencia(
  banco: BancoDados,
  valores: ValoresAparencia,
  escopo: EscopoAparencia,
): void {
  banco.transaction((transacao) => {
    gravarValoresAparencia(transacao, escopo, valores);
  }, TRANSACAO_ESCRITA);
}

export function salvarSuperficies(
  banco: BancoDados,
  superficies: SuperficiesBoard,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): void {
  gravarAparencia(banco, superficies, escopo);
}

export function salvarCoresPrioridade(
  banco: BancoDados,
  cores: CoresPrioridade,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): void {
  gravarAparencia(
    banco,
    {
      corPrioridadeCritica: cores.critica,
      corPrioridadeAlta: cores.alta,
      corPrioridadeMedia: cores.media,
      corPrioridadeBaixa: cores.baixa,
    },
    escopo,
  );
}
