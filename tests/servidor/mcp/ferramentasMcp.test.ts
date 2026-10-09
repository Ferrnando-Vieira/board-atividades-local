import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LIMITES_ANEXO } from '@/config/anexos';
import { CATALOGO_API } from '@/servidor/api/catalogoApi';
import { montarUrl } from '@/servidor/mcp/clienteApiBoard';
import {
  executarFerramenta,
  FERRAMENTAS_MCP,
  montarRequisicaoFerramenta,
} from '@/servidor/mcp/ferramentasMcp';
import type { ResultadoFerramenta } from '@/servidor/mcp/protocoloMcp';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';

const URL_API = 'http://127.0.0.1:3000/api/v1';
const TOKEN = 'bat_token-de-teste';

function lerTexto(resultado: ResultadoFerramenta): string | undefined {
  const [conteudo] = resultado.content;
  return conteudo?.type === 'text' ? conteudo.text : undefined;
}

function respostaArquivo(tipoConteudo: string, conteudo: Uint8Array): Response {
  return new Response(new Uint8Array(conteudo), {
    status: 200,
    headers: { 'Content-Type': tipoConteudo },
  });
}

function respostaJson(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ferramentasMcp', () => {
  it('deve ter uma ferramenta por endpoint do catálogo, com nomes únicos', () => {
    const nomes = FERRAMENTAS_MCP.map((ferramenta) => ferramenta.name);

    expect(FERRAMENTAS_MCP).toHaveLength(CATALOGO_API.length);
    expect(new Set(nomes).size).toBe(nomes.length);
    expect(nomes).toEqual(
      expect.arrayContaining([
        'identificar_token',
        'listar_atividades',
        'criar_atividade',
        'mover_atividade',
        'excluir_status',
        'editar_tag',
        'listar_lembretes',
        'criar_lembrete',
        'ler_lembrete',
        'atualizar_lembrete',
        'desativar_lembrete',
        'reativar_lembrete',
        'excluir_lembrete',
      ]),
    );
  });

  it('deve publicar esquemas JSON de objeto e anotações coerentes com o método', () => {
    const porNome = new Map(FERRAMENTAS_MCP.map((item) => [item.name, item]));

    for (const ferramenta of FERRAMENTAS_MCP) {
      expect(ferramenta.inputSchema).toEqual(
        expect.objectContaining({ type: 'object' }),
      );
      expect(ferramenta.inputSchema).not.toHaveProperty('$schema');
    }
    expect(porNome.get('ler_board')?.annotations).toEqual(
      expect.objectContaining({ readOnlyHint: true, destructiveHint: false }),
    );
    expect(porNome.get('excluir_tag')?.annotations).toEqual(
      expect.objectContaining({ readOnlyHint: false, destructiveHint: true }),
    );
    expect(porNome.get('criar_atividade')?.inputSchema).toEqual(
      expect.objectContaining({ required: ['titulo'] }),
    );
  });

  it('deve montar caminho, corpo e consulta a partir dos argumentos', () => {
    expect(
      montarRequisicaoFerramenta('mover_atividade', {
        id: 7,
        versaoEsperada: 3,
        statusId: 2,
      }),
    ).toEqual({
      metodo: 'POST',
      caminho: '/api/v1/atividades/7/mover',
      consulta: undefined,
      corpo: { versaoEsperada: 3, statusId: 2 },
    });
    expect(
      montarRequisicaoFerramenta('excluir_status', {
        id: 4,
        versaoEsperada: 2,
        statusDestinoId: 1,
      }),
    ).toEqual(
      expect.objectContaining({
        metodo: 'DELETE',
        caminho: '/api/v1/status/4',
        consulta: { versaoEsperada: 2, statusDestinoId: 1 },
      }),
    );
  });

  it('deve repetir parâmetros de lista na URL e respeitar o prefixo configurado', () => {
    expect(
      montarUrl(URL_API, '/api/v1/atividades', {
        status: [1, 2],
        busca: 'fatura',
        situacao: undefined,
      }),
    ).toBe(
      'http://127.0.0.1:3000/api/v1/atividades?status=1&status=2&busca=fatura',
    );
    expect(montarUrl('https://board.lan/board/api/v1/', '/api/v1/board')).toBe(
      'https://board.lan/board/api/v1/board',
    );
  });

  it('deve recusar argumentos inválidos sem chamar a API', async () => {
    const buscar = jest.fn();

    const resultado = await executarFerramenta(
      { urlApi: URL_API, token: TOKEN, buscar },
      'ler_atividade',
      { id: 'sete' },
    );

    expect(buscar).not.toHaveBeenCalled();
    expect(resultado.isError).toBe(true);
    expect(lerTexto(resultado)).toContain('Argumentos inválidos');
  });

  it('deve enviar o token e devolver os dados da API', async () => {
    const buscar = jest.fn(() =>
      Promise.resolve(respostaJson(200, { dados: { id: 7, titulo: 'X' } })),
    );

    const resultado = await executarFerramenta(
      { urlApi: URL_API, token: TOKEN, buscar },
      'ler_atividade',
      { id: 7 },
    );

    expect(buscar).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/v1/atividades/7',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(resultado).toEqual({
      content: [
        { type: 'text', text: JSON.stringify({ id: 7, titulo: 'X' }, null, 2) },
      ],
      structuredContent: { dados: { id: 7, titulo: 'X' } },
    });
  });

  it('deve transformar o erro da API em resultado de erro com os campos', async () => {
    const buscar = jest.fn(() =>
      Promise.resolve(
        respostaJson(409, {
          erro: {
            codigo: 'conflito-de-versao',
            mensagem: 'A atividade foi alterada.',
            campos: { versaoEsperada: ['Desatualizada.'] },
          },
        }),
      ),
    );

    const resultado = await executarFerramenta(
      { urlApi: URL_API, token: TOKEN, buscar },
      'arquivar_atividade',
      { id: 1, versaoEsperada: 1 },
    );

    expect(resultado.isError).toBe(true);
    expect(lerTexto(resultado)).toBe(
      'Erro 409 (conflito-de-versao): A atividade foi alterada.\n- versaoEsperada: Desatualizada.',
    );
  });

  it('deve orientar quando o board está desligado ou falta o token', async () => {
    const desligado = await executarFerramenta(
      {
        urlApi: URL_API,
        token: TOKEN,
        buscar: jest.fn(() => Promise.reject(new TypeError('fetch failed'))),
      },
      'ler_board',
      {},
    );
    const semToken = await executarFerramenta(
      { urlApi: URL_API, token: null },
      'ler_board',
      {},
    );

    expect(desligado.isError).toBe(true);
    expect(lerTexto(desligado)).toContain('npm run dev');
    expect(semToken.isError).toBe(true);
    expect(lerTexto(semToken)).toContain('BOARD_API_TOKEN');
  });

  it('deve recusar posicao em mover_atividade, que não altera a ordem', async () => {
    const buscar = jest.fn();

    const resultado = await executarFerramenta(
      { urlApi: URL_API, token: TOKEN, buscar },
      'mover_atividade',
      { id: 7, versaoEsperada: 3, statusId: 2, posicao: 0 },
    );

    expect(buscar).not.toHaveBeenCalled();
    expect(resultado.isError).toBe(true);
  });

  it('deve avisar que a operação pode ter sido gravada quando o tempo esgota', async () => {
    const resultado = await executarFerramenta(
      {
        urlApi: URL_API,
        token: TOKEN,
        buscar: jest.fn(() =>
          Promise.reject(new DOMException('tempo', 'TimeoutError')),
        ),
      },
      'criar_atividade',
      { titulo: 'Conferir fretes' },
    );

    expect(resultado.isError).toBe(true);
    expect(lerTexto(resultado)).toContain('pode ter sido gravada');
    expect(lerTexto(resultado)).not.toContain('npm run dev');
  });

  it('deve montar os caminhos de histórico, lembrete da atividade e solicitante padrão', () => {
    expect(
      montarRequisicaoFerramenta('ler_historico_atividade', { id: 7 }),
    ).toEqual(
      expect.objectContaining({
        metodo: 'GET',
        caminho: '/api/v1/atividades/7/historico',
      }),
    );
    expect(
      montarRequisicaoFerramenta('definir_lembrete_atividade', {
        id: 7,
        versaoEsperada: 2,
        lembreteData: '2026-10-20',
        lembreteHora: '09:00',
      }),
    ).toEqual(
      expect.objectContaining({
        metodo: 'PUT',
        caminho: '/api/v1/atividades/7/lembrete',
        corpo: {
          versaoEsperada: 2,
          lembreteData: '2026-10-20',
          lembreteHora: '09:00',
        },
      }),
    );
    expect(
      montarRequisicaoFerramenta('excluir_lembrete_atividade', {
        id: 7,
        versaoEsperada: 3,
      }),
    ).toEqual(
      expect.objectContaining({
        metodo: 'DELETE',
        caminho: '/api/v1/atividades/7/lembrete',
        consulta: { versaoEsperada: 3 },
      }),
    );
    expect(
      montarRequisicaoFerramenta('desativar_lembrete_atividade', {
        id: 7,
        versaoEsperada: 3,
      }),
    ).toEqual(
      expect.objectContaining({
        caminho: '/api/v1/atividades/7/lembrete/desativar',
      }),
    );
    expect(
      montarRequisicaoFerramenta('definir_solicitante_padrao', {
        nome: 'Financeiro',
      }),
    ).toEqual(
      expect.objectContaining({
        metodo: 'PUT',
        caminho: '/api/v1/solicitantes/padrao',
        corpo: { nome: 'Financeiro' },
      }),
    );
  });

  describe('anexos', () => {
    let diretorio: string;

    beforeEach(() => {
      diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-anexos-'));
    });

    afterEach(() => {
      fs.rmSync(diretorio, { recursive: true, force: true });
    });

    it('deve montar os caminhos com o id da atividade e do anexo', () => {
      expect(
        montarRequisicaoFerramenta('remover_anexo', { id: 7, anexoId: 12 }),
      ).toEqual(
        expect.objectContaining({
          metodo: 'DELETE',
          caminho: '/api/v1/atividades/7/anexos/12',
        }),
      );
      expect(
        montarRequisicaoFerramenta('ler_anexo', { id: 7, anexoId: 12 }),
      ).toEqual(
        expect.objectContaining({
          metodo: 'GET',
          caminho: '/api/v1/atividades/7/anexos/12',
        }),
      );
      expect(montarRequisicaoFerramenta('listar_anexos', { id: 7 })).toEqual(
        expect.objectContaining({ caminho: '/api/v1/atividades/7/anexos' }),
      );
    });

    it('deve ler os arquivos locais e enviá-los em multipart no campo "arquivo"', async () => {
      const caminho = path.join(diretorio, 'print.png');
      fs.writeFileSync(caminho, CONTEUDOS_ANEXO.png);
      const buscar = jest.fn<Promise<Response>, Parameters<typeof fetch>>(() =>
        Promise.resolve(respostaJson(201, { dados: [{ id: 12 }] })),
      );

      const resultado = await executarFerramenta(
        { urlApi: URL_API, token: TOKEN, buscar },
        'anexar_arquivos',
        { id: 7, arquivos: [caminho] },
      );

      expect(resultado.isError).toBeUndefined();
      const [url, opcoes] = buscar.mock.calls[0] ?? [];
      expect(url).toBe('http://127.0.0.1:3000/api/v1/atividades/7/anexos');
      expect(opcoes?.headers).not.toHaveProperty('Content-Type');
      const corpo = opcoes?.body;
      expect(corpo).toBeInstanceOf(FormData);
      const arquivos = (corpo as FormData).getAll('arquivo') as File[];
      expect(arquivos.map((arquivo) => arquivo.name)).toEqual(['print.png']);
      expect(new Uint8Array(await arquivos[0]!.arrayBuffer())).toEqual(
        CONTEUDOS_ANEXO.png,
      );
    });

    it('deve recusar caminho relativo e arquivo inexistente sem chamar a API', async () => {
      const buscar = jest.fn();
      const configuracao = { urlApi: URL_API, token: TOKEN, buscar };

      const relativo = await executarFerramenta(
        configuracao,
        'anexar_arquivos',
        { id: 7, arquivos: ['print.png'] },
      );
      const inexistente = await executarFerramenta(
        configuracao,
        'anexar_arquivos',
        { id: 7, arquivos: [path.join(diretorio, 'nao-existe.png')] },
      );

      expect(buscar).not.toHaveBeenCalled();
      expect(lerTexto(relativo)).toContain('caminho absoluto');
      expect(inexistente.isError).toBe(true);
      expect(lerTexto(inexistente)).toContain('nao-existe.png');
    });

    it('deve recusar envio acima do total por envio sem chamar a API', async () => {
      const buscar = jest.fn();
      const caminhos = ['a.txt', 'b.txt', 'c.txt'].map((nome) => {
        const caminho = path.join(diretorio, nome);
        fs.writeFileSync(caminho, '');
        fs.truncateSync(caminho, LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES - 1);
        return caminho;
      });

      const resultado = await executarFerramenta(
        { urlApi: URL_API, token: TOKEN, buscar },
        'anexar_arquivos',
        { id: 7, arquivos: caminhos },
      );

      expect(buscar).not.toHaveBeenCalled();
      expect(resultado.isError).toBe(true);
      expect(lerTexto(resultado)).toContain('Envie em partes');
    });

    it('deve devolver imagem como conteúdo de imagem, texto como texto e outros tipos só descritos', async () => {
      async function lerAnexo(resposta: Response) {
        return executarFerramenta(
          {
            urlApi: URL_API,
            token: TOKEN,
            buscar: jest.fn(() => Promise.resolve(resposta)),
          },
          'ler_anexo',
          { id: 7, anexoId: 12 },
        );
      }

      const imagem = await lerAnexo(
        respostaArquivo('image/png', CONTEUDOS_ANEXO.png),
      );
      const texto = await lerAnexo(
        respostaArquivo('text/csv', CONTEUDOS_ANEXO.texto),
      );
      const pdf = await lerAnexo(
        respostaArquivo('application/pdf', CONTEUDOS_ANEXO.pdf),
      );

      expect(imagem.content).toEqual([
        {
          type: 'image',
          data: Buffer.from(CONTEUDOS_ANEXO.png).toString('base64'),
          mimeType: 'image/png',
        },
      ]);
      expect(lerTexto(texto)).toBe('Data;Valor\n01/10/2026;10,50\n');
      expect(lerTexto(pdf)).toContain('application/pdf');
    });
  });

  describe('lembretes avulsos', () => {
    it('deve montar a criação com data e hora no fuso do board', () => {
      expect(
        montarRequisicaoFerramenta('criar_lembrete', {
          titulo: 'Revisar checklist de publicação em staging',
          lembreteData: '2026-10-06',
          lembreteHora: '13:28',
        }),
      ).toEqual({
        metodo: 'POST',
        caminho: '/api/v1/lembretes',
        consulta: undefined,
        corpo: {
          titulo: 'Revisar checklist de publicação em staging',
          lembreteData: '2026-10-06',
          lembreteHora: '13:28',
        },
      });
    });

    it('deve separar o id do corpo ao remarcar e levar a versão na consulta ao excluir', () => {
      expect(
        montarRequisicaoFerramenta('atualizar_lembrete', {
          id: 7,
          versaoEsperada: 2,
          lembreteHora: '15:00',
          observacao: null,
        }),
      ).toEqual({
        metodo: 'PATCH',
        caminho: '/api/v1/lembretes/7',
        consulta: undefined,
        corpo: { versaoEsperada: 2, lembreteHora: '15:00', observacao: null },
      });
      expect(
        montarRequisicaoFerramenta('excluir_lembrete', {
          id: 7,
          versaoEsperada: 3,
        }),
      ).toEqual({
        metodo: 'DELETE',
        caminho: '/api/v1/lembretes/7',
        consulta: { versaoEsperada: 3 },
        corpo: undefined,
      });
    });

    it('deve usar os caminhos de desativar, reativar e do filtro por situação', () => {
      expect(
        montarRequisicaoFerramenta('desativar_lembrete', {
          id: 4,
          versaoEsperada: 1,
        }),
      ).toEqual(
        expect.objectContaining({
          metodo: 'POST',
          caminho: '/api/v1/lembretes/4/desativar',
          corpo: { versaoEsperada: 1 },
        }),
      );
      expect(
        montarRequisicaoFerramenta('reativar_lembrete', {
          id: 4,
          versaoEsperada: 2,
        }),
      ).toEqual(
        expect.objectContaining({
          caminho: '/api/v1/lembretes/4/reativar',
        }),
      );
      expect(
        montarRequisicaoFerramenta('listar_lembretes', {
          situacao: 'pendente',
        }),
      ).toEqual(
        expect.objectContaining({
          metodo: 'GET',
          caminho: '/api/v1/lembretes',
          consulta: { situacao: 'pendente' },
        }),
      );
    });

    it('deve recusar argumentos incompletos ou inválidos sem chamar a API', async () => {
      const buscar = jest.fn();
      const configuracao = { urlApi: URL_API, token: TOKEN, buscar };

      const semHora = await executarFerramenta(configuracao, 'criar_lembrete', {
        titulo: 'X',
        lembreteData: '2026-10-06',
      });
      const situacaoInvalida = await executarFerramenta(
        configuracao,
        'listar_lembretes',
        { situacao: 'feito' },
      );
      expect(buscar).not.toHaveBeenCalled();
      for (const resultado of [semHora, situacaoInvalida]) {
        expect(resultado.isError).toBe(true);
        expect(lerTexto(resultado)).toContain('Argumentos inválidos');
      }
    });

    it('deve marcar leitura, exclusão e permissão na descrição das ferramentas', () => {
      const porNome = new Map(
        FERRAMENTAS_MCP.map((ferramenta) => [ferramenta.name, ferramenta]),
      );

      expect(porNome.get('listar_lembretes')?.annotations).toEqual(
        expect.objectContaining({ readOnlyHint: true }),
      );
      expect(porNome.get('excluir_lembrete')?.annotations).toEqual(
        expect.objectContaining({ destructiveHint: true }),
      );
      expect(porNome.get('criar_lembrete')?.description).toContain(
        'Permissão: atividades:escrever.',
      );
      expect(porNome.get('ler_lembrete')?.description).toContain(
        'Permissão: atividades:ler.',
      );
    });
  });
});
