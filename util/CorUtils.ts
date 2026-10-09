// Cálculos de cor (WCAG 2.x) usados para decidir a cor do texto sobre fundos
// e superfícies translúcidas escolhidos pelo proprietário. Só trabalham com
// "#rrggbb" em minúsculas, o mesmo formato que o banco aceita.
export const FORMATO_COR_HEXADECIMAL = /^#[0-9a-f]{6}$/;

export const CONTRASTE_MINIMO_AA = 4.5;
const CONTRASTE_MINIMO_ATENCAO = 3;

const BASE_HEXADECIMAL = 16;
const MAXIMO_CANAL = 255;
const LIMIAR_LINEAR_SRGB = 0.04045;
const DIVISOR_LINEAR_SRGB = 12.92;
const DESLOCAMENTO_SRGB = 0.055;
const EXPOENTE_SRGB = 2.4;
const PESOS_LUMINANCIA = [0.2126, 0.7152, 0.0722] as const;
const ACRESCIMO_CONTRASTE = 0.05;
const INICIOS_CANAIS = [1, 3, 5] as const;
const TAMANHO_CANAL = 2;

export type TomTexto = 'escuro' | 'claro';

export type CoresTexto = {
  principal: string;
  suave: string;
};

// Mesmos valores dos tokens do tema (app/globals.css); um teste confere.
export const CORES_TEXTO_POR_TOM: Record<TomTexto, CoresTexto> = {
  escuro: { principal: '#1d2a1c', suave: '#55634f' },
  claro: { principal: '#ffffff', suave: '#e4ebe1' },
};

export type NivelLeitura = 'boa' | 'atencao' | 'dificil';

export function ehCorHexadecimal(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMATO_COR_HEXADECIMAL.test(valor);
}

export function lerCanais(cor: string): number[] {
  return INICIOS_CANAIS.map((inicio) =>
    Number.parseInt(
      cor.slice(inicio, inicio + TAMANHO_CANAL),
      BASE_HEXADECIMAL,
    ),
  );
}

function formatarCanais(canais: readonly number[]): string {
  return `#${canais
    .map((canal) =>
      canal.toString(BASE_HEXADECIMAL).padStart(TAMANHO_CANAL, '0'),
    )
    .join('')}`;
}

export function luminanciaRelativa(cor: string): number {
  return lerCanais(cor)
    .map((canal) => canal / MAXIMO_CANAL)
    .map((canal) =>
      canal <= LIMIAR_LINEAR_SRGB
        ? canal / DIVISOR_LINEAR_SRGB
        : ((canal + DESLOCAMENTO_SRGB) / (1 + DESLOCAMENTO_SRGB)) **
          EXPOENTE_SRGB,
    )
    .reduce(
      (soma, canal, indice) => soma + canal * (PESOS_LUMINANCIA[indice] ?? 0),
      0,
    );
}

export function calcularContraste(primeira: string, segunda: string): number {
  const [maior = 0, menor = 0] = [
    luminanciaRelativa(primeira),
    luminanciaRelativa(segunda),
  ].sort((a, b) => b - a);
  return (maior + ACRESCIMO_CONTRASTE) / (menor + ACRESCIMO_CONTRASTE);
}

// Cor efetiva de uma superfície com a opacidade dada (0 a 1) sobre o fundo.
export function sobrepor(
  frente: string,
  fundo: string,
  opacidade: number,
): string {
  const canaisFrente = lerCanais(frente);
  return formatarCanais(
    lerCanais(fundo).map((canal, indice) =>
      Math.round(
        (canaisFrente[indice] ?? 0) * opacidade + canal * (1 - opacidade),
      ),
    ),
  );
}

export type EscolhaTom = {
  tom: TomTexto;
  // Pior contraste do texto principal entre as amostras do fundo.
  contraste: number;
  // Cores efetivas da superfície sobre cada amostra (para empilhar camadas).
  coresEfetivas: string[];
};

function piorContraste(texto: string, cores: readonly string[]): number {
  return Math.min(...cores.map((cor) => calcularContraste(texto, cor)));
}

function avaliarTom(tom: TomTexto, cores: readonly string[]): number {
  const { principal, suave } = CORES_TEXTO_POR_TOM[tom];
  return Math.min(piorContraste(principal, cores), piorContraste(suave, cores));
}

// Escolhe o tom de texto que fica mais legível no pior ponto do fundo (um
// gradiente pode ir do claro ao escuro). Com tom forçado, só calcula o
// contraste resultante para a tela avisar quando a leitura fica difícil.
export function escolherTomTexto(
  amostras: readonly string[],
  corSuperficie: string,
  opacidade: number,
  tomForcado: TomTexto | null = null,
): EscolhaTom {
  const coresEfetivas = amostras.map((amostra) =>
    sobrepor(corSuperficie, amostra, opacidade),
  );
  const tom =
    tomForcado ??
    (avaliarTom('escuro', coresEfetivas) >= avaliarTom('claro', coresEfetivas)
      ? 'escuro'
      : 'claro');
  return {
    tom,
    contraste: piorContraste(CORES_TEXTO_POR_TOM[tom].principal, coresEfetivas),
    coresEfetivas,
  };
}

// Texto sobre cor sólida (selos de prioridade, chips de tag).
export function corTextoSobre(cor: string): string {
  const { escuro, claro } = CORES_TEXTO_POR_TOM;
  return calcularContraste(escuro.principal, cor) >=
    calcularContraste(claro.principal, cor)
    ? escuro.principal
    : claro.principal;
}

export function classificarLeitura(contraste: number): NivelLeitura {
  if (contraste >= CONTRASTE_MINIMO_AA) {
    return 'boa';
  }
  return contraste >= CONTRASTE_MINIMO_ATENCAO ? 'atencao' : 'dificil';
}

// Borda um pouco mais escura que a cor, para chips claros não sumirem sobre o
// cartão branco.
const FATOR_ESCURECER_BORDA = 0.82;

export function escurecer(cor: string, fator = FATOR_ESCURECER_BORDA): string {
  return formatarCanais(
    lerCanais(cor).map((canal) => Math.round(canal * fator)),
  );
}

const CANAIS_POR_PIXEL = 4;
const INDICE_ALFA = 3;
const ALFA_MINIMO_CONSIDERADO = 16;

// Média dos pixels (RGBA, como em ImageData.data) que não são quase
// transparentes; usada para estimar o tom de uma imagem de fundo.
export function calcularCorMedia(pixels: ArrayLike<number>): string | null {
  const somas = [0, 0, 0];
  let quantidade = 0;
  for (let inicio = 0; inicio < pixels.length; inicio += CANAIS_POR_PIXEL) {
    if ((pixels[inicio + INDICE_ALFA] ?? 0) < ALFA_MINIMO_CONSIDERADO) {
      continue;
    }
    for (let canal = 0; canal < somas.length; canal += 1) {
      somas[canal] = (somas[canal] ?? 0) + (pixels[inicio + canal] ?? 0);
    }
    quantidade += 1;
  }
  if (quantidade === 0) {
    return null;
  }
  return formatarCanais(somas.map((soma) => Math.round(soma / quantidade)));
}
