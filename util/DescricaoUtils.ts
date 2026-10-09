// A descrição é Markdown. Imagens entram como "![texto](anexo:ID)", que
// aponta para um anexo gravado da própria atividade; uma imagem colada que
// ainda está só na tela usa "anexo-novo:CHAVE" e vira "anexo:ID" quando a
// atividade é salva. Nenhuma das duas formas é um endereço: quem exibe decide
// para onde cada referência aponta (ou se ela aparece como indisponível).
export const ESQUEMA_REFERENCIA_ANEXO = 'anexo:';
export const ESQUEMA_REFERENCIA_ANEXO_NOVO = 'anexo-novo:';

const FORMATO_CHAVE_ANEXO_NOVO = /^[a-z0-9]{8,32}$/;
const FORMATO_ID_ANEXO = /^[1-9]\d{0,12}$/;
// Destino de imagem/link no Markdown: "](anexo:12)" ou "](anexo-novo:abc…)",
// com um título opcional depois de um espaço.
const REFERENCIAS_ANEXO_NOVO = /(\]\(\s*)anexo-novo:([a-z0-9]{8,32})(?=[\s)])/g;
const REFERENCIAS_ANEXO = /\]\(\s*anexo:([1-9]\d{0,12})(?=[\s)])/g;
const CARACTERES_ESPECIAIS_TEXTO_ALTERNATIVO = /[[\]\\]/g;
const QUEBRAS_DE_LINHA = /\s*[\r\n]+\s*/g;

export type ReferenciaAnexo =
  { tipo: 'anexo'; anexoId: number } | { tipo: 'novo'; chave: string };

export function ehChaveAnexoNovo(valor: string): boolean {
  return FORMATO_CHAVE_ANEXO_NOVO.test(valor);
}

export function montarReferenciaAnexo(anexoId: number): string {
  return `${ESQUEMA_REFERENCIA_ANEXO}${anexoId}`;
}

export function montarReferenciaAnexoNovo(chave: string): string {
  return `${ESQUEMA_REFERENCIA_ANEXO_NOVO}${chave}`;
}

export function lerReferenciaAnexo(url: string): ReferenciaAnexo | null {
  if (url.startsWith(ESQUEMA_REFERENCIA_ANEXO_NOVO)) {
    const chave = url.slice(ESQUEMA_REFERENCIA_ANEXO_NOVO.length);
    return ehChaveAnexoNovo(chave) ? { tipo: 'novo', chave } : null;
  }
  if (url.startsWith(ESQUEMA_REFERENCIA_ANEXO)) {
    const valor = url.slice(ESQUEMA_REFERENCIA_ANEXO.length);
    return FORMATO_ID_ANEXO.test(valor)
      ? { tipo: 'anexo', anexoId: Number(valor) }
      : null;
  }
  return null;
}

// O texto alternativo vira o nome exibido quando a imagem não carrega:
// colchetes e barras não podem fechar a marcação antes da hora.
export function montarMarcacaoImagem(
  textoAlternativo: string,
  referencia: string,
): string {
  const texto = textoAlternativo
    .replace(QUEBRAS_DE_LINHA, ' ')
    .replace(CARACTERES_ESPECIAIS_TEXTO_ALTERNATIVO, '')
    .trim();
  return `![${texto}](${referencia})`;
}

export function listarChavesAnexosNovos(descricao: string): string[] {
  return [
    ...new Set(
      Array.from(
        descricao.matchAll(REFERENCIAS_ANEXO_NOVO),
        (correspondencia) => correspondencia[2] ?? '',
      ),
    ),
  ].filter(ehChaveAnexoNovo);
}

export function listarIdsAnexosReferenciados(descricao: string): number[] {
  return [
    ...new Set(
      Array.from(descricao.matchAll(REFERENCIAS_ANEXO), (correspondencia) =>
        Number(correspondencia[1]),
      ),
    ),
  ];
}

// Troca cada "anexo-novo:CHAVE" pelo anexo gravado. Chave sem anexo fica como
// está (aparece como imagem indisponível). O resultado nunca fica maior que a
// entrada: "anexo:ID" é mais curto que "anexo-novo:" com uma chave válida.
export function substituirReferenciasAnexosNovos(
  descricao: string,
  anexosPorChave: ReadonlyMap<string, number>,
): string {
  return descricao.replace(
    REFERENCIAS_ANEXO_NOVO,
    (original, abertura: string, chave: string) => {
      const anexoId = anexosPorChave.get(chave);
      return anexoId === undefined
        ? original
        : `${abertura}${montarReferenciaAnexo(anexoId)}`;
    },
  );
}
