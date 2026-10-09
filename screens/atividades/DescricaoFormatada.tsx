import type { Root } from 'mdast';
import Markdown, {
  defaultUrlTransform,
  type Components,
  type UrlTransform,
} from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import BlocoCodigoDescricao from '@/screens/atividades/BlocoCodigoDescricao';
import type { ImagensDescricao } from '@/screens/atividades/imagensDescricao';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { combinarClasses } from '@/util/ClassesUtils';
import { lerReferenciaAnexo } from '@/util/DescricaoUtils';

type NoMarkdown = {
  type: string;
  value?: string;
  children?: NoMarkdown[];
};

// Nós em que o HTML aparece como bloco (fora de um parágrafo).
const CONTEINERES_DE_BLOCO = new Set([
  'root',
  'blockquote',
  'listItem',
  'footnoteDefinition',
]);

// HTML escrito na descrição aparece como texto, igual a antes da formatação
// ("<Lista>" num relato de erro não some). Nada vira HTML de verdade; o
// bloco de HTML vira um parágrafo com o texto.
function converterHtmlEmTexto(no: NoMarkdown): void {
  const emBloco = CONTEINERES_DE_BLOCO.has(no.type);
  no.children = no.children?.map((filho) => {
    if (filho.type !== 'html') {
      converterHtmlEmTexto(filho);
      return filho;
    }
    const texto = { type: 'text', value: filho.value ?? '' };
    return emBloco ? { type: 'paragraph', children: [texto] } : texto;
  });
}

function remarkHtmlComoTexto() {
  return (arvore: Root) => {
    converterHtmlEmTexto(arvore as NoMarkdown);
  };
}

// GFM (tabelas, listas de tarefas, tachado, links automáticos) e quebra de
// linha simples preservada, como nas descrições em texto puro de antes. O HTML
// vira texto antes das quebras, para que elas valham também nele.
const PLUGINS_MARKDOWN = [remarkGfm, remarkHtmlComoTexto, remarkBreaks];

const ENDERECO_WEB = /^https?:\/\//i;

// Referências "anexo:" passam como estão para o componente de imagem, que
// decide se há imagem para elas; o resto segue a regra padrão (sem
// javascript:, data: etc.).
const transformarUrl: UrlTransform = (url, chave, elemento) =>
  elemento.tagName === 'img' && chave === 'src' && lerReferenciaAnexo(url)
    ? url
    : defaultUrlTransform(url);

type PropriedadesImagem = {
  src: unknown;
  alt: string | undefined;
  imagens: ImagensDescricao;
};

// Imagem só sai do mapa (anexos da própria atividade ou imagens coladas ainda
// não salvas). Endereço externo vira link, para a página não buscar nada fora
// do board sem o usuário pedir.
function ImagemDaDescricao({ src, alt, imagens }: PropriedadesImagem) {
  const nome = alt ?? '';
  const imagem = typeof src === 'string' ? imagens[src] : undefined;
  if (imagem) {
    const elemento = (
      // Anexo privado servido pela própria rota autorizada; o otimizador de
      // imagens do Next não tem acesso a ele.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imagem.src} alt={nome} loading="lazy" decoding="async" />
    );
    return imagem.href ? (
      <a
        href={imagem.href}
        target="_blank"
        rel="noopener noreferrer"
        className="imagem-descricao"
      >
        {elemento}
      </a>
    ) : (
      <span className="imagem-descricao">{elemento}</span>
    );
  }
  if (typeof src === 'string' && ENDERECO_WEB.test(src)) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer">
        {textosAtividades.imagemExterna(nome)}
      </a>
    );
  }
  return (
    <span className="imagem-indisponivel">
      {textosAtividades.imagemIndisponivel(nome)}
    </span>
  );
}

function montarComponentes(imagens: ImagensDescricao): Components {
  return {
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    img: ({ src, alt }) => (
      <ImagemDaDescricao src={src} alt={alt} imagens={imagens} />
    ),
    pre: ({ children }) => (
      <BlocoCodigoDescricao>{children}</BlocoCodigoDescricao>
    ),
    table: ({ children }) => (
      <div className="tabela-descricao">
        <table>{children}</table>
      </div>
    ),
  };
}

type PropriedadesDescricaoFormatada = {
  texto: string;
  imagens: ImagensDescricao;
  className?: string;
};

export default function DescricaoFormatada({
  texto,
  imagens,
  className,
}: PropriedadesDescricaoFormatada) {
  return (
    <div className={combinarClasses('descricao-formatada', className)}>
      <Markdown
        remarkPlugins={PLUGINS_MARKDOWN}
        urlTransform={transformarUrl}
        components={montarComponentes(imagens)}
      >
        {texto}
      </Markdown>
    </div>
  );
}
