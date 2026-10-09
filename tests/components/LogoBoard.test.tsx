import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import LogoBoard from '@/components/ui/LogoBoard';

const ELEMENTO_DESENHO = /<(rect|path|ellipse|circle|g)\b([^>]*?)\/?>/g;
const ATRIBUTO = /([a-z-]+)="([^"]*)"/g;

// Cada forma do desenho como "tag atributo=valor ...", na ordem do arquivo.
function listarFormas(svg: string): string[] {
  return [...svg.matchAll(ELEMENTO_DESENHO)].map(([, tag, atributos = '']) =>
    [
      tag,
      ...[...atributos.matchAll(ATRIBUTO)]
        .map(([, nome, valor]) => `${nome}=${valor}`)
        .sort(),
    ].join(' '),
  );
}

describe('LogoBoard', () => {
  it('deve desenhar o mesmo ícone de app/icon.svg', () => {
    const arquivo = fs.readFileSync(
      path.join(process.cwd(), 'app', 'icon.svg'),
      'utf8',
    );

    const formasDoLogo = listarFormas(renderToStaticMarkup(<LogoBoard />));

    expect(formasDoLogo.length).toBeGreaterThan(10);
    expect(formasDoLogo).toEqual(listarFormas(arquivo));
  });

  it('deve ser decorativo para leitores de tela', () => {
    expect(renderToStaticMarkup(<LogoBoard />)).toContain('aria-hidden="true"');
  });
});
