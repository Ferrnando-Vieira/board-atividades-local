import type { CSSProperties } from 'react';
import {
  CORES_PRIORIDADE_PADRAO,
  NIVEIS_PRIORIDADE,
  type CoresPrioridade,
  type ModoTomTexto,
  type SuperficiesBoard,
} from '@/config/aparenciaBoard';
import {
  corTextoSobre,
  ehCorHexadecimal,
  escolherTomTexto,
  escurecer,
  type TomTexto,
} from '@/util/CorUtils';
import type { NivelPrioridade } from '@/util/PrioridadeUtils';

const PORCENTAGEM = 100;
const COR_BRANCA = '#ffffff';
const SEM_OPACIDADE = 0;

// Variáveis CSS (`--nome`) passadas no atributo style; os valores já saem
// conferidos (cores #rrggbb e números), nunca de texto livre.
export type VariaveisCss = Record<`--${string}`, string>;

export type AparenciaSuperficie = {
  cor: string;
  // Porcentagem inteira, como guardada no banco.
  opacidade: number;
  tom: TomTexto;
  contraste: number;
};

export type AparenciaColuna = {
  titulo: AparenciaSuperficie;
  coluna: AparenciaSuperficie;
};

export type CoresProprias = {
  corTitulo: string | null;
  corColuna: string | null;
};

function obterTomForcado(modo: ModoTomTexto): TomTexto | null {
  return modo === 'automatico' ? null : modo;
}

// O corpo da coluna fica sobre o fundo do board e o título fica sobre o corpo
// da coluna; por isso a amostra do título é a cor efetiva da coluna. Cores
// próprias do status (tela Status) substituem as globais (Aparência).
export function calcularAparenciaColuna(
  amostrasFundo: readonly string[],
  superficies: SuperficiesBoard,
  coresProprias: CoresProprias = { corTitulo: null, corColuna: null },
): AparenciaColuna {
  const tomForcado = obterTomForcado(superficies.tomTexto);
  const corColuna = coresProprias.corColuna ?? superficies.corColunas;
  const corTitulo = coresProprias.corTitulo ?? superficies.corTitulos;
  const coluna = escolherTomTexto(
    amostrasFundo,
    corColuna,
    superficies.opacidadeColunas / PORCENTAGEM,
    tomForcado,
  );
  const titulo = escolherTomTexto(
    coluna.coresEfetivas,
    corTitulo,
    superficies.opacidadeTitulos / PORCENTAGEM,
    tomForcado,
  );
  return {
    coluna: {
      cor: corColuna,
      opacidade: superficies.opacidadeColunas,
      tom: coluna.tom,
      contraste: coluna.contraste,
    },
    titulo: {
      cor: corTitulo,
      opacidade: superficies.opacidadeTitulos,
      tom: titulo.tom,
      contraste: titulo.contraste,
    },
  };
}

// Texto posto direto sobre o fundo (avisos de carregamento, por exemplo).
export function calcularTomFundo(amostrasFundo: readonly string[]): TomTexto {
  return escolherTomTexto(amostrasFundo, COR_BRANCA, SEM_OPACIDADE).tom;
}

export function montarVariaveisColuna(
  aparencia: AparenciaColuna,
): VariaveisCss {
  return {
    '--cor-titulo': aparencia.titulo.cor,
    '--opacidade-titulo': String(aparencia.titulo.opacidade / PORCENTAGEM),
    '--cor-coluna': aparencia.coluna.cor,
    '--opacidade-coluna': String(aparencia.coluna.opacidade / PORCENTAGEM),
  };
}

export type CoresPrioridadePersonalizadas = Record<
  NivelPrioridade,
  string | null
>;

export function resolverCoresPrioridade(
  personalizadas: CoresPrioridadePersonalizadas,
): CoresPrioridade {
  return {
    critica: personalizadas.critica ?? CORES_PRIORIDADE_PADRAO.critica,
    alta: personalizadas.alta ?? CORES_PRIORIDADE_PADRAO.alta,
    media: personalizadas.media ?? CORES_PRIORIDADE_PADRAO.media,
    baixa: personalizadas.baixa ?? CORES_PRIORIDADE_PADRAO.baixa,
  };
}

export function montarVariaveisPrioridade(
  cores: CoresPrioridade,
): VariaveisCss {
  return Object.fromEntries(
    NIVEIS_PRIORIDADE.flatMap((nivel) => [
      [`--cor-prioridade-${nivel}`, cores[nivel]],
      [`--texto-prioridade-${nivel}`, corTextoSobre(cores[nivel])],
    ]),
  ) as VariaveisCss;
}

// Chip de tag colorida: fundo na cor escolhida, texto pelo contraste e borda
// um pouco mais escura. Sem cor, vale o chip neutro das classes do tema.
export function montarEstiloTag(
  cor: string | null | undefined,
): CSSProperties | undefined {
  if (!cor || !ehCorHexadecimal(cor)) {
    return undefined;
  }
  return {
    backgroundColor: cor,
    borderColor: escurecer(cor),
    color: corTextoSobre(cor),
  };
}
