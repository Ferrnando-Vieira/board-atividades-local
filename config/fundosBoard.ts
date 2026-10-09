import { FORMATO_COR_HEXADECIMAL } from '@/util/CorUtils';

// Catálogo fechado: o banco (CHECK) e o servidor (Zod) só aceitam estas
// chaves, e o estilo aplicado sai daqui, nunca de CSS ou URL enviados pelo
// cliente. Todas as cores são claras para que os textos do tema (texto e
// texto-suave) mantenham contraste AA sobre o fundo e sobre as colunas.
export const FUNDO_BOARD_PADRAO = 'padrao';

// Igual ao token --color-fundo do tema (um teste confere): é o fundo que vale
// quando o padrão está escolhido.
export const COR_FUNDO_TEMA = '#f4f6f3';

export type TipoFundoPredefinido =
  'tema' | 'solido' | 'linear' | 'radial' | 'malha';

type DefinicaoFundo = {
  rotulo: string;
  tipo: TipoFundoPredefinido;
  cores: readonly string[];
};

const ANGULO_GRADIENTE_CLASSICO = 160;
const ANGULO_GRADIENTE_DIAGONAL = 135;
const ANGULO_GRADIENTE_HORIZONTAL = 90;

export const FUNDOS_BOARD = {
  padrao: { rotulo: 'Padrão do tema', tipo: 'tema', cores: [] },
  'cor-areia': { rotulo: 'Areia', tipo: 'solido', cores: ['#f6f1e7'] },
  'cor-ceu': { rotulo: 'Céu', tipo: 'solido', cores: ['#eaf2fb'] },
  'cor-lavanda': { rotulo: 'Lavanda', tipo: 'solido', cores: ['#f2eefa'] },
  'cor-menta': { rotulo: 'Menta', tipo: 'solido', cores: ['#e7f5ee'] },
  'cor-nevoa': { rotulo: 'Névoa', tipo: 'solido', cores: ['#eef0f3'] },
  'gradiente-amanhecer': {
    rotulo: 'Amanhecer',
    tipo: 'linear',
    cores: ['#fdf1e6', '#f4e9f7'],
  },
  'gradiente-oceano': {
    rotulo: 'Oceano',
    tipo: 'linear',
    cores: ['#e5f2f8', '#eeeffb'],
  },
  'gradiente-campo': {
    rotulo: 'Campo',
    tipo: 'linear',
    cores: ['#edf6e8', '#f8f5e4'],
  },
  'gradiente-aurora': {
    rotulo: 'Aurora',
    tipo: 'linear',
    cores: ['#e7f5f0', '#efeafa'],
  },
  'cor-gelo': { rotulo: 'Gelo', tipo: 'solido', cores: ['#f1f5f9'] },
  'cor-pessego': { rotulo: 'Pêssego', tipo: 'solido', cores: ['#fdf0e8'] },
  'gradiente-pastel': {
    rotulo: 'Pastel',
    tipo: 'linear',
    cores: ['#fdf2f8', '#eef2ff', '#ecfeff'],
  },
  'gradiente-brisa': {
    rotulo: 'Brisa',
    tipo: 'linear',
    cores: ['#e0f2fe', '#f0fdf4'],
  },
  'radial-luar': {
    rotulo: 'Luar (radial)',
    tipo: 'radial',
    cores: ['#ffffff', '#e9edf2'],
  },
  'radial-pessego': {
    rotulo: 'Pôr do sol (radial)',
    tipo: 'radial',
    cores: ['#fff7ed', '#f3e8f5'],
  },
  'radial-lagoa': {
    rotulo: 'Lagoa (radial)',
    tipo: 'radial',
    cores: ['#ecfeff', '#e6eafb'],
  },
  'malha-primavera': {
    rotulo: 'Primavera (malha)',
    tipo: 'malha',
    cores: ['#f8fafc', '#e0f2fe', '#fae8ff', '#dcfce7'],
  },
  'malha-entardecer': {
    rotulo: 'Entardecer (malha)',
    tipo: 'malha',
    cores: ['#fffbf5', '#fde9e1', '#ede9fe', '#fef3c7'],
  },
} as const satisfies Record<string, DefinicaoFundo>;

export type ChaveFundoBoard = keyof typeof FUNDOS_BOARD;

export const CHAVES_FUNDO_BOARD = Object.keys(FUNDOS_BOARD) as [
  ChaveFundoBoard,
  ...ChaveFundoBoard[],
];

// Lista do CHECK de `boards.fundo` (migração 0002). A coluna ficou só como
// legado: a escolha passou para `fundos_board` na 0003, e recriar `boards`
// para ampliar o CHECK apagaria em cascata status, atividades e links.
export const CHAVES_FUNDO_LEGADO = [
  'padrao',
  'cor-areia',
  'cor-ceu',
  'cor-lavanda',
  'cor-menta',
  'cor-nevoa',
  'gradiente-amanhecer',
  'gradiente-oceano',
  'gradiente-campo',
  'gradiente-aurora',
] as const satisfies readonly ChaveFundoBoard[];

const ANGULOS_LINEARES: Partial<Record<ChaveFundoBoard, number>> = {
  'gradiente-pastel': ANGULO_GRADIENTE_DIAGONAL,
  'gradiente-brisa': ANGULO_GRADIENTE_HORIZONTAL,
};

// Posições das manchas da malha, na ordem das cores depois da cor de base.
const POSICOES_MALHA = ['15% 20%', '85% 15%', '50% 100%'] as const;
const ALCANCE_MANCHA_MALHA = '55%';
const FORMA_RADIAL = 'ellipse at top';

export type EstiloFundoBoard = {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
};

export function ehChaveFundoBoard(valor: unknown): valor is ChaveFundoBoard {
  return (
    typeof valor === 'string' &&
    (CHAVES_FUNDO_BOARD as readonly string[]).includes(valor)
  );
}

function montarMalha(cores: readonly string[]): string {
  return cores
    .slice(1)
    .map(
      (cor, indice) =>
        `radial-gradient(at ${POSICOES_MALHA[indice] ?? POSICOES_MALHA[0]}, ${cor} 0, transparent ${ALCANCE_MANCHA_MALHA})`,
    )
    .join(', ');
}

// O padrão não gera estilo: vale o `bg-fundo` do tema, inclusive em modo de
// alto contraste do sistema.
export function montarEstiloFundoBoard(
  chave: ChaveFundoBoard,
): EstiloFundoBoard | undefined {
  const definicao: DefinicaoFundo = FUNDOS_BOARD[chave];
  const [primeira] = definicao.cores;
  if (primeira === undefined) {
    return undefined;
  }
  const cores = definicao.cores.join(', ');
  switch (definicao.tipo) {
    case 'linear':
      return {
        backgroundColor: primeira,
        backgroundImage: `linear-gradient(${ANGULOS_LINEARES[chave] ?? ANGULO_GRADIENTE_CLASSICO}deg, ${cores})`,
      };
    case 'radial':
      return {
        backgroundColor: primeira,
        backgroundImage: `radial-gradient(${FORMA_RADIAL}, ${cores})`,
      };
    case 'malha':
      return {
        backgroundColor: primeira,
        backgroundImage: montarMalha(definicao.cores),
      };
    default:
      return { backgroundColor: primeira };
  }
}

export const FORMATOS_GRADIENTE = ['linear', 'radial'] as const;

export type FormatoGradiente = (typeof FORMATOS_GRADIENTE)[number];

export const LIMITES_GRADIENTE = {
  ANGULO_MINIMO: 0,
  ANGULO_MAXIMO: 360,
  CORES_MINIMAS: 2,
  CORES_MAXIMAS: 3,
} as const;

// Igual ao valor de <input type="color">; o servidor converte para
// minúsculas antes de conferir, e o banco repete a conferência no CHECK.
export { FORMATO_COR_HEXADECIMAL };

export type GradientePersonalizado = {
  formato: FormatoGradiente;
  angulo: number;
  cores: readonly string[];
};

export const GRADIENTE_PERSONALIZADO_PADRAO = {
  formato: 'linear',
  angulo: ANGULO_GRADIENTE_DIAGONAL,
  cores: ['#dbeafe', '#ede9fe'],
} as const satisfies GradientePersonalizado;

function ehGradienteSeguro(gradiente: GradientePersonalizado): boolean {
  return (
    Number.isInteger(gradiente.angulo) &&
    gradiente.angulo >= LIMITES_GRADIENTE.ANGULO_MINIMO &&
    gradiente.angulo <= LIMITES_GRADIENTE.ANGULO_MAXIMO &&
    gradiente.cores.length >= LIMITES_GRADIENTE.CORES_MINIMAS &&
    gradiente.cores.length <= LIMITES_GRADIENTE.CORES_MAXIMAS &&
    gradiente.cores.every((cor) => FORMATO_COR_HEXADECIMAL.test(cor))
  );
}

const GRAUS_MEIA_VOLTA = 180;
const CENTRO_PERCENTUAL = 50;

// No radial o ângulo diz de onde vem a luz, na mesma convenção do linear:
// 0° = topo, 90° = direita, 180° = base, 270° = esquerda. O centro da elipse
// fica na borda da tela nessa direção (0° equivale ao antigo "at top").
export function calcularCentroRadial(angulo: number): string {
  const radianos = (angulo * Math.PI) / GRAUS_MEIA_VOLTA;
  const horizontal = Math.round(
    CENTRO_PERCENTUAL + CENTRO_PERCENTUAL * Math.sin(radianos),
  );
  const vertical = Math.round(
    CENTRO_PERCENTUAL - CENTRO_PERCENTUAL * Math.cos(radianos),
  );
  // `+ 0` evita "-0%" quando o seno ou o cosseno arredonda para zero negativo.
  return `ellipse at ${horizontal + 0}% ${vertical + 0}%`;
}

// Só valores já conferidos chegam ao CSS: um gradiente fora das regras não
// gera estilo nenhum (fica o fundo do tema), em vez de ir para o atributo.
export function montarEstiloGradientePersonalizado(
  gradiente: GradientePersonalizado,
): EstiloFundoBoard | undefined {
  if (!ehGradienteSeguro(gradiente)) {
    return undefined;
  }
  const cores = gradiente.cores.join(', ');
  return {
    backgroundColor: gradiente.cores[0],
    backgroundImage:
      gradiente.formato === 'linear'
        ? `linear-gradient(${gradiente.angulo}deg, ${cores})`
        : `radial-gradient(${calcularCentroRadial(gradiente.angulo)}, ${cores})`,
  };
}

// Cores que representam o fundo para o cálculo de contraste: o texto precisa
// ficar legível no pior ponto (um gradiente pode ir do claro ao escuro).
export function obterCoresFundoBoard(chave: ChaveFundoBoard): string[] {
  const cores: readonly string[] = FUNDOS_BOARD[chave].cores;
  return cores.length > 0 ? [...cores] : [COR_FUNDO_TEMA];
}

// O endereço é sempre uma rota interna montada pelo próprio servidor (com o
// hash da imagem como versão); qualquer outro formato é descartado.
const FORMATO_ROTA_IMAGEM = /^\/[A-Za-z0-9/_-]*\?v=[0-9a-f]+$/;

export function montarEstiloImagemFundo(
  rotaImagem: string,
): EstiloFundoBoard | undefined {
  if (!FORMATO_ROTA_IMAGEM.test(rotaImagem)) {
    return undefined;
  }
  return {
    backgroundImage: `url("${rotaImagem}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

const BYTES_POR_MEBIBYTE = 1024 * 1024;

export const TIPOS_FUNDO_BOARD = [
  'predefinido',
  'gradiente',
  'imagem',
] as const;

export type TipoFundoBoard = (typeof TIPOS_FUNDO_BOARD)[number];

// GIF fica de fora (animação custa processamento em toda tela) e SVG também
// (pode carregar script). O limite é menor que o dos anexos para não pesar
// no carregamento do board em celulares da rede.
export const LIMITES_IMAGEM_FUNDO = {
  TAMANHO_MAXIMO_BYTES: 5 * BYTES_POR_MEBIBYTE,
} as const;

export const FORMATOS_IMAGEM_FUNDO = ['png', 'jpeg', 'webp'] as const;

export type FormatoImagemFundo = (typeof FORMATOS_IMAGEM_FUNDO)[number];

// O banco guarda o formato (literal simples, aceito no CHECK); o tipo de
// conteúdo da resposta sai deste mapa, nunca do que o navegador declarou.
export const TIPO_CONTEUDO_IMAGEM_FUNDO: Record<FormatoImagemFundo, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const ACEITE_CAMPO_IMAGEM_FUNDO = '.png,.jpg,.jpeg,.webp';

export function obterFormatoImagemFundo(
  tipoConteudo: string,
): FormatoImagemFundo | null {
  return (
    FORMATOS_IMAGEM_FUNDO.find(
      (formato) => TIPO_CONTEUDO_IMAGEM_FUNDO[formato] === tipoConteudo,
    ) ?? null
  );
}
