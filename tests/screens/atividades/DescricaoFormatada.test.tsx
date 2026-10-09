import { renderToStaticMarkup } from 'react-dom/server';
import DescricaoFormatada from '@/screens/atividades/DescricaoFormatada';
import {
  montarImagensDescricao,
  type ImagensDescricao,
} from '@/screens/atividades/imagensDescricao';
import { textosAtividades } from '@/screens/atividades/textosAtividades';

const PREFIXO_LINK = '/compartilhado/token-de-teste';

const IMAGENS = montarImagensDescricao(
  [
    { id: 12, tipoConteudo: 'image/png' },
    { id: 13, tipoConteudo: 'application/pdf' },
  ],
  PREFIXO_LINK,
);

function renderizar(texto: string, imagens: ImagensDescricao = IMAGENS) {
  return renderToStaticMarkup(
    <DescricaoFormatada texto={texto} imagens={imagens} />,
  );
}

describe('DescricaoFormatada', () => {
  it('deve formatar negrito, itálico, código, listas e títulos', () => {
    const html = renderizar(
      '## Passos\n\n**negrito** _itálico_ `codigo()` ~~tachado~~\n\n- um\n- dois\n\n1. primeiro\n\n- [x] feito',
    );

    expect(html).toContain('<h2>Passos</h2>');
    expect(html).toContain('<strong>negrito</strong>');
    expect(html).toContain('<em>itálico</em>');
    expect(html).toContain('<code>codigo()</code>');
    expect(html).toContain('<del>tachado</del>');
    expect(html).toContain('<li>um</li>');
    expect(html).toContain('<ol>');
    expect(html).toContain('type="checkbox"');
  });

  it('deve manter as quebras de linha simples das descrições em texto puro', () => {
    const html = renderizar('Linha um\nLinha dois');

    expect(html).toContain('Linha um<br/>');
  });

  it('deve mostrar o bloco de código com o botão de copiar', () => {
    const html = renderizar('```sql\nSELECT * FROM tabela;\n```');

    expect(html).toContain('class="language-sql"');
    expect(html).toContain('SELECT * FROM tabela;');
    expect(html).toContain(textosAtividades.rotuloCopiarCodigo);
  });

  it('deve mostrar HTML escrito na descrição como texto, sem interpretá-lo', () => {
    const html = renderizar(
      'Erro na <Lista> ao salvar\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>',
    );

    expect(html).toContain('<p>Erro na &lt;Lista&gt; ao salvar</p>');
    expect(html).toContain('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(html).toContain('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
  });

  it('deve manter as quebras de linha de um bloco de HTML virado texto', () => {
    const html = renderizar('<div>\nconteúdo\n</div>');

    expect(html).toContain('<p>&lt;div&gt;<br/>');
  });

  it('não deve gerar links com javascript: nem data:', () => {
    const html = renderizar(
      '[a](javascript:alert(1)) [b](data:text/html,oi) [c](https://exemplo.com)',
    );

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text');
    expect(html).toContain('href="https://exemplo.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('deve exibir a imagem de um anexo da atividade pela rota do acesso', () => {
    const html = renderizar('![tela de erro](anexo:12)');

    expect(html).toContain(
      `src="${PREFIXO_LINK}/anexos/12/imagem" alt="tela de erro"`,
    );
  });

  it('deve mostrar como indisponível a imagem que não é anexo de imagem da atividade', () => {
    const html = renderizar(
      '![pdf](anexo:13) ![de outra atividade](anexo:99) ![nova](anexo-novo:abcdef0123456789)',
    );

    expect(html).not.toContain('<img');
    expect(html).toContain(textosAtividades.imagemIndisponivel('pdf'));
    expect(html).toContain(
      textosAtividades.imagemIndisponivel('de outra atividade'),
    );
    expect(html).toContain(textosAtividades.imagemIndisponivel('nova'));
  });

  it('deve exibir a imagem colada ainda não salva quando ela está no mapa', () => {
    const html = renderizar('![nova](anexo-novo:abcdef0123456789)', {
      'anexo-novo:abcdef0123456789': { src: 'blob:local/1', href: null },
    });

    expect(html).toContain('src="blob:local/1"');
  });

  it('deve trocar imagem externa por link, sem buscar nada fora do board', () => {
    const html = renderizar('![logo](https://exemplo.com/logo.png)');

    expect(html).not.toContain('<img');
    expect(html).toContain('href="https://exemplo.com/logo.png"');
    expect(html).toContain(textosAtividades.imagemExterna('logo'));
  });
});
