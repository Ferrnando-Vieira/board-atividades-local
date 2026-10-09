import {
  formatarSelecao,
  inserirEmLinhasProprias,
  type EdicaoTexto,
  type FormatacaoDescricao,
  type SelecaoTexto,
} from '@/screens/atividades/formatacaoDescricao';

const TEXTO_LINK = 'texto do link';

// Marca a seleção com colchetes angulares: "a <b> c" seleciona "b"; "a |c"
// é o cursor sem seleção.
function selecionar(marcado: string): SelecaoTexto {
  if (marcado.includes('|')) {
    const inicio = marcado.indexOf('|');
    return { texto: marcado.replace('|', ''), inicio, fim: inicio };
  }
  const inicio = marcado.indexOf('<');
  const fim = marcado.indexOf('>') - 1;
  return { texto: marcado.replace('<', '').replace('>', ''), inicio, fim };
}

function aplicar(selecao: SelecaoTexto, edicao: EdicaoTexto) {
  const texto =
    selecao.texto.slice(0, edicao.de) +
    edicao.insercao +
    selecao.texto.slice(edicao.ate);
  return {
    texto,
    selecionado: texto.slice(edicao.selecaoInicio, edicao.selecaoFim),
    cursor: edicao.selecaoInicio,
  };
}

function formatar(marcado: string, formatacao: FormatacaoDescricao) {
  const selecao = selecionar(marcado);
  return aplicar(selecao, formatarSelecao(selecao, formatacao, TEXTO_LINK));
}

describe('formatacaoDescricao', () => {
  describe('marcadores no texto', () => {
    it.each([
      ['negrito', 'um **dois** três'],
      ['italico', 'um _dois_ três'],
      ['tachado', 'um ~~dois~~ três'],
      ['codigo', 'um `dois` três'],
    ] as const)('deve aplicar %s à seleção', (formatacao, esperado) => {
      const resultado = formatar('um <dois> três', formatacao);

      expect(resultado.texto).toBe(esperado);
      expect(resultado.selecionado).toBe('dois');
    });

    it('deve remover o negrito quando a seleção já está marcada por fora', () => {
      const resultado = formatar('um **<dois>** três', 'negrito');

      expect(resultado.texto).toBe('um dois três');
      expect(resultado.selecionado).toBe('dois');
    });

    it('deve remover o negrito quando a seleção inclui os marcadores', () => {
      const resultado = formatar('um <**dois**> três', 'negrito');

      expect(resultado.texto).toBe('um dois três');
    });

    it('não deve incluir os espaços das pontas da seleção na marcação', () => {
      const resultado = formatar('um< dois >três', 'negrito');

      expect(resultado.texto).toBe('um **dois** três');
    });

    it('sem seleção, deve abrir os marcadores com o cursor no meio', () => {
      const resultado = formatar('um |', 'negrito');

      expect(resultado.texto).toBe('um ****');
      expect(resultado.cursor).toBe(5);
    });

    it('deve usar crase dupla para código que tem crase', () => {
      const resultado = formatar('rode <a`b>', 'codigo');

      expect(resultado.texto).toBe('rode `` a`b ``');
      expect(resultado.selecionado).toBe('a`b');
    });
  });

  describe('bloco de código', () => {
    it('sem seleção, deve abrir um bloco vazio com o cursor dentro', () => {
      const resultado = formatar('Erro:|', 'blocoCodigo');

      expect(resultado.texto).toBe('Erro:\n```\n\n```');
      expect(resultado.cursor).toBe('Erro:\n```\n'.length);
    });

    it('deve colocar o trecho selecionado em linhas próprias dentro do bloco', () => {
      const resultado = formatar(
        'veja <const a = 1;\nconst b = 2;> aqui',
        'blocoCodigo',
      );

      expect(resultado.texto).toBe(
        'veja \n```\nconst a = 1;\nconst b = 2;\n```\n aqui',
      );
      expect(resultado.selecionado).toBe('const a = 1;\nconst b = 2;');
    });

    it('deve usar uma cerca maior quando o trecho já tem ```', () => {
      const resultado = formatar('<```js\nx\n```>', 'blocoCodigo');

      expect(resultado.texto).toBe('````\n```js\nx\n```\n````');
    });

    it('deve virar bloco quando o código no texto tem várias linhas', () => {
      const resultado = formatar('<linha 1\nlinha 2>', 'codigo');

      expect(resultado.texto).toBe('```\nlinha 1\nlinha 2\n```');
    });
  });

  describe('prefixos de linha', () => {
    it('deve transformar as linhas selecionadas em lista', () => {
      const resultado = formatar('<maçã\nbanana>', 'lista');

      expect(resultado.texto).toBe('- maçã\n- banana');
    });

    it('deve numerar as linhas e pular as vazias', () => {
      const resultado = formatar('<um\n\ndois\ntrês>', 'listaNumerada');

      expect(resultado.texto).toBe('1. um\n\n2. dois\n3. três');
    });

    it('deve trocar o tipo de lista sem acumular marcadores', () => {
      const resultado = formatar('<- um\n- dois>', 'listaTarefas');

      expect(resultado.texto).toBe('- [ ] um\n- [ ] dois');
    });

    it('deve remover o prefixo quando todas as linhas já o têm', () => {
      const texto = '> citação\n> continua';
      const selecao = { texto, inicio: 0, fim: texto.length };

      const resultado = aplicar(
        selecao,
        formatarSelecao(selecao, 'citacao', TEXTO_LINK),
      );

      expect(resultado.texto).toBe('citação\ncontinua');
    });

    it('deve aplicar à primeira linha mesmo com o texto começando por quebra', () => {
      const resultado = formatar('|\nsegunda', 'lista');

      expect(resultado.texto).toBe('- \nsegunda');
    });

    it('sem seleção, deve aplicar à linha do cursor', () => {
      const resultado = formatar('antes\nTít|ulo\ndepois', 'titulo');

      expect(resultado.texto).toBe('antes\n## Título\ndepois');
    });

    it('não deve alcançar a linha seguinte numa seleção de linha inteira', () => {
      const resultado = formatar('<item\n>outra', 'lista');

      expect(resultado.texto).toBe('- item\noutra');
    });
  });

  describe('link', () => {
    it('sem seleção, deve inserir o modelo com o rótulo selecionado', () => {
      const resultado = formatar('veja |', 'link');

      expect(resultado.texto).toBe(`veja [${TEXTO_LINK}](https://)`);
      expect(resultado.selecionado).toBe(TEXTO_LINK);
    });

    it('com texto, deve selecionar o endereço para ser digitado', () => {
      const resultado = formatar('veja <a ata>', 'link');

      expect(resultado.texto).toBe('veja [a ata](https://)');
      expect(resultado.selecionado).toBe('https://');
    });

    it('com um endereço, deve usá-lo e selecionar o rótulo', () => {
      const resultado = formatar('<https://exemplo.com/a?b=1>', 'link');

      expect(resultado.texto).toBe(
        `[${TEXTO_LINK}](https://exemplo.com/a?b=1)`,
      );
      expect(resultado.selecionado).toBe(TEXTO_LINK);
    });
  });

  describe('inserirEmLinhasProprias', () => {
    it('deve pôr as imagens em linhas próprias e o cursor na linha seguinte', () => {
      const selecao = selecionar('Antes|depois');

      const resultado = aplicar(
        selecao,
        inserirEmLinhasProprias(selecao, ['![a](anexo:1)', '![b](anexo:2)']),
      );

      expect(resultado.texto).toBe(
        'Antes\n![a](anexo:1)\n![b](anexo:2)\ndepois',
      );
      expect(resultado.texto.slice(resultado.cursor)).toBe('depois');
    });

    it('não deve duplicar quebras que já existem', () => {
      const selecao = selecionar('Antes\n|\ndepois');

      const resultado = aplicar(
        selecao,
        inserirEmLinhasProprias(selecao, ['![a](anexo:1)']),
      );

      expect(resultado.texto).toBe('Antes\n![a](anexo:1)\ndepois');
    });
  });
});
