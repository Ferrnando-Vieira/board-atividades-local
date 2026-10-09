// Formatação da descrição em Markdown a partir da seleção do campo. Cada
// função devolve só o trecho a trocar e a seleção resultante: quem aplica é o
// editor (com execCommand, para o Ctrl+Z do navegador continuar funcionando).

export type SelecaoTexto = {
  texto: string;
  inicio: number;
  fim: number;
};

// Troca [de, ate) por `insercao`; a seleção final já é no texto alterado.
export type EdicaoTexto = {
  de: number;
  ate: number;
  insercao: string;
  selecaoInicio: number;
  selecaoFim: number;
};

export const FORMATACOES_DESCRICAO = [
  'negrito',
  'italico',
  'tachado',
  'titulo',
  'lista',
  'listaNumerada',
  'listaTarefas',
  'citacao',
  'codigo',
  'blocoCodigo',
  'link',
] as const;

export type FormatacaoDescricao = (typeof FORMATACOES_DESCRICAO)[number];

const MARCADORES_EM_LINHA = {
  negrito: '**',
  italico: '_',
  tachado: '~~',
} as const;

type FormatacaoDeLinha =
  'titulo' | 'lista' | 'listaNumerada' | 'listaTarefas' | 'citacao';

const PREFIXOS_DE_LINHA: Record<FormatacaoDeLinha, RegExp> = {
  titulo: /^#{1,6}[ \t]+/,
  lista: /^[-*+][ \t]+(?!\[[ xX]\][ \t])/,
  listaNumerada: /^\d{1,9}[.)][ \t]+/,
  listaTarefas: /^[-*+][ \t]+\[[ xX]\][ \t]+/,
  citacao: /^>[ \t]?/,
};

// Ao trocar o tipo de lista, o marcador anterior sai antes de entrar o novo.
const MARCADOR_DE_LISTA = /^([-*+][ \t]+(\[[ xX]\][ \t]+)?|\d{1,9}[.)][ \t]+)/;
const MARCADOR_DE_TITULO = /^#{1,6}[ \t]+/;
const ESPACO = /\s/;
const ENDERECO_WEB = /^https?:\/\/\S+$/i;
const CRASE = '`';
const CERCA_CODIGO = '```';
const QUEBRA = '\n';
const ENDERECO_PADRAO_LINK = 'https://';

function montarPrefixo(tipo: FormatacaoDeLinha, posicao: number): string {
  switch (tipo) {
    case 'titulo':
      return '## ';
    case 'lista':
      return '- ';
    case 'listaNumerada':
      return `${posicao + 1}. `;
    case 'listaTarefas':
      return '- [ ] ';
    case 'citacao':
      return '> ';
  }
}

// Duplo clique no Windows seleciona a palavra com o espaço seguinte; a
// marcação fica só em volta do texto.
function aparSelecao(selecao: SelecaoTexto): SelecaoTexto {
  let { inicio, fim } = selecao;
  while (inicio < fim && ESPACO.test(selecao.texto[inicio] ?? '')) {
    inicio += 1;
  }
  while (fim > inicio && ESPACO.test(selecao.texto[fim - 1] ?? '')) {
    fim -= 1;
  }
  return { texto: selecao.texto, inicio, fim };
}

function alternarMarcador(
  selecaoOriginal: SelecaoTexto,
  marcador: string,
): EdicaoTexto {
  const selecao = aparSelecao(selecaoOriginal);
  const { texto, inicio, fim } = selecao;
  const selecionado = texto.slice(inicio, fim);
  const tamanho = marcador.length;
  const marcadoPorFora =
    texto.slice(inicio - tamanho, inicio) === marcador &&
    texto.slice(fim, fim + tamanho) === marcador;
  if (inicio >= tamanho && marcadoPorFora) {
    return {
      de: inicio - tamanho,
      ate: fim + tamanho,
      insercao: selecionado,
      selecaoInicio: inicio - tamanho,
      selecaoFim: fim - tamanho,
    };
  }
  if (
    selecionado.length >= tamanho * 2 &&
    selecionado.startsWith(marcador) &&
    selecionado.endsWith(marcador)
  ) {
    const interno = selecionado.slice(tamanho, -tamanho);
    return {
      de: inicio,
      ate: fim,
      insercao: interno,
      selecaoInicio: inicio,
      selecaoFim: inicio + interno.length,
    };
  }
  return {
    de: inicio,
    ate: fim,
    insercao: `${marcador}${selecionado}${marcador}`,
    selecaoInicio: inicio + tamanho,
    selecaoFim: fim + tamanho,
  };
}

function quebraAntes(texto: string, posicao: number): string {
  return posicao > 0 && texto[posicao - 1] !== QUEBRA ? QUEBRA : '';
}

function quebraDepois(texto: string, posicao: number): string {
  return posicao < texto.length && texto[posicao] !== QUEBRA ? QUEBRA : '';
}

// Cerca maior que qualquer sequência de crases do trecho, para que um código
// com ``` dentro não feche o bloco antes da hora.
function montarCerca(conteudo: string): string {
  const maiorSequencia = Math.max(
    0,
    ...Array.from(conteudo.matchAll(/`+/g), (sequencia) => sequencia[0].length),
  );
  return maiorSequencia >= CERCA_CODIGO.length
    ? CRASE.repeat(maiorSequencia + 1)
    : CERCA_CODIGO;
}

// Sem seleção: abre um bloco vazio com o cursor dentro, pronto para colar o
// trecho. Com seleção: o trecho vai para dentro do bloco, em linhas próprias.
function envolverEmBloco(selecao: SelecaoTexto): EdicaoTexto {
  const { texto, inicio } = selecao;
  let { fim } = selecao;
  if (fim > inicio && texto[fim - 1] === QUEBRA) {
    fim -= 1;
  }
  const selecionado = texto.slice(inicio, fim);
  const cerca = montarCerca(selecionado);
  const antes = quebraAntes(texto, inicio);
  const depois = quebraDepois(texto, fim);
  const abertura = `${antes}${cerca}${QUEBRA}`;
  return {
    de: inicio,
    ate: fim,
    insercao: `${abertura}${selecionado}${QUEBRA}${cerca}${depois}`,
    selecaoInicio: inicio + abertura.length,
    selecaoFim: inicio + abertura.length + selecionado.length,
  };
}

function marcarCodigo(selecaoOriginal: SelecaoTexto): EdicaoTexto {
  const selecao = aparSelecao(selecaoOriginal);
  const selecionado = selecao.texto.slice(selecao.inicio, selecao.fim);
  if (selecionado.includes(QUEBRA)) {
    return envolverEmBloco(selecaoOriginal);
  }
  if (!selecionado.includes(CRASE)) {
    return alternarMarcador(selecaoOriginal, CRASE);
  }
  // Código com crase: duas crases e espaços, como manda o CommonMark.
  return {
    de: selecao.inicio,
    ate: selecao.fim,
    insercao: `${CRASE}${CRASE} ${selecionado} ${CRASE}${CRASE}`,
    selecaoInicio: selecao.inicio + 3,
    selecaoFim: selecao.fim + 3,
  };
}

function limitesDasLinhas(selecao: SelecaoTexto): { de: number; ate: number } {
  const { texto, inicio } = selecao;
  // Seleção que termina logo depois de uma quebra (clique triplo) não
  // inclui a linha seguinte.
  const fim =
    selecao.fim > inicio && texto[selecao.fim - 1] === QUEBRA
      ? selecao.fim - 1
      : selecao.fim;
  // lastIndexOf com posição negativa procura na posição 0: no começo do
  // texto, a linha começa ali mesmo.
  const de = inicio === 0 ? 0 : texto.lastIndexOf(QUEBRA, inicio - 1) + 1;
  const proximaQuebra = texto.indexOf(QUEBRA, fim);
  return { de, ate: proximaQuebra === -1 ? texto.length : proximaQuebra };
}

// Liga ou desliga o prefixo em cada linha tocada pela seleção: se todas as
// linhas com texto já têm o prefixo, ele sai; senão entra em todas.
function alternarPrefixo(
  selecao: SelecaoTexto,
  tipo: FormatacaoDeLinha,
): EdicaoTexto {
  const { de, ate } = limitesDasLinhas(selecao);
  const linhas = selecao.texto.slice(de, ate).split(QUEBRA);
  const padrao = PREFIXOS_DE_LINHA[tipo];
  const comTexto = linhas.filter((linha) => linha.trim() !== '');
  const remover =
    comTexto.length > 0 && comTexto.every((linha) => padrao.test(linha));
  let posicao = 0;
  const novas = linhas.map((linha) => {
    if (remover) {
      return linha.replace(padrao, '');
    }
    if (linha.trim() === '' && linhas.length > 1) {
      return linha;
    }
    const semMarcador =
      tipo === 'citacao'
        ? linha
        : linha.replace(
            tipo === 'titulo' ? MARCADOR_DE_TITULO : MARCADOR_DE_LISTA,
            '',
          );
    const prefixo = montarPrefixo(tipo, posicao);
    posicao += 1;
    return `${prefixo}${semMarcador}`;
  });
  const insercao = novas.join(QUEBRA);
  const semSelecao = selecao.inicio === selecao.fim;
  return {
    de,
    ate,
    insercao,
    selecaoInicio: semSelecao ? de + insercao.length : de,
    selecaoFim: de + insercao.length,
  };
}

function inserirLink(
  selecaoOriginal: SelecaoTexto,
  textoPadrao: string,
): EdicaoTexto {
  const selecao = aparSelecao(selecaoOriginal);
  const selecionado = selecao.texto.slice(selecao.inicio, selecao.fim);
  if (ENDERECO_WEB.test(selecionado)) {
    return {
      de: selecao.inicio,
      ate: selecao.fim,
      insercao: `[${textoPadrao}](${selecionado})`,
      selecaoInicio: selecao.inicio + 1,
      selecaoFim: selecao.inicio + 1 + textoPadrao.length,
    };
  }
  const rotulo = selecionado === '' ? textoPadrao : selecionado;
  const insercao = `[${rotulo}](${ENDERECO_PADRAO_LINK})`;
  const inicioRotulo = selecao.inicio + 1;
  const inicioEndereco = inicioRotulo + rotulo.length + 2;
  return {
    de: selecao.inicio,
    ate: selecao.fim,
    insercao,
    // Sem seleção, o rótulo fica selecionado para ser digitado; com texto,
    // o endereço.
    selecaoInicio: selecionado === '' ? inicioRotulo : inicioEndereco,
    selecaoFim:
      selecionado === ''
        ? inicioRotulo + rotulo.length
        : inicioEndereco + ENDERECO_PADRAO_LINK.length,
  };
}

export function formatarSelecao(
  selecao: SelecaoTexto,
  formatacao: FormatacaoDescricao,
  textoPadraoLink: string,
): EdicaoTexto {
  switch (formatacao) {
    case 'negrito':
    case 'italico':
    case 'tachado':
      return alternarMarcador(selecao, MARCADORES_EM_LINHA[formatacao]);
    case 'codigo':
      return marcarCodigo(selecao);
    case 'blocoCodigo':
      return envolverEmBloco(selecao);
    case 'link':
      return inserirLink(selecao, textoPadraoLink);
    case 'titulo':
    case 'lista':
    case 'listaNumerada':
    case 'listaTarefas':
    case 'citacao':
      return alternarPrefixo(selecao, formatacao);
  }
}

// Imagens entram em linhas próprias no lugar da seleção, e o cursor vai para
// a linha seguinte, para o texto continuar abaixo delas.
export function inserirEmLinhasProprias(
  selecao: SelecaoTexto,
  linhas: readonly string[],
): EdicaoTexto {
  const { texto, inicio, fim } = selecao;
  const depois = texto[fim] === QUEBRA ? '' : QUEBRA;
  const insercao = `${quebraAntes(texto, inicio)}${linhas.join(QUEBRA)}${depois}`;
  const posicaoFinal = inicio + insercao.length;
  return {
    de: inicio,
    ate: fim,
    insercao,
    selecaoInicio: posicaoFinal,
    selecaoFim: posicaoFinal,
  };
}
