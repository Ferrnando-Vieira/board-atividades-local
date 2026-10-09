jest.mock('@/servidor/web/bancoAplicacao', () => ({
  CODIGO_BANCO_AUSENTE: 'banco-ausente',
  obterBancoAplicacao: jest.fn(),
}));

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LIMITES_ANEXO } from '@/config/anexos';
import {
  esquemaAtividadeApi,
  esquemaHistoricoApi,
  esquemaListaAnexosApi,
  type AtividadeApi,
} from '@/servidor/api/esquemasApi';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import { chamarApi, MODULOS_ROTA_API } from '@/tests/suporte/clienteApi';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';
import {
  cadastrarAdministrador,
  criarTokenApiDeTeste,
} from '@/tests/suporte/fabricasCompartilhamento';

const diretorioAnexos = fs.mkdtempSync(
  path.join(os.tmpdir(), 'board-api-anexos-'),
);
process.env.DIRETORIO_ANEXOS = diretorioAnexos;

function exigirRota(caminho: string) {
  const modulo = MODULOS_ROTA_API[caminho];
  if (!modulo) {
    throw new Error(`Rota ${caminho} ausente no mapa de teste.`);
  }
  return modulo;
}

const ATIVIDADES = exigirRota('/api/v1/atividades');
const ATIVIDADE = exigirRota('/api/v1/atividades/{id}');
const ARQUIVAR = exigirRota('/api/v1/atividades/{id}/arquivar');
const HISTORICO = exigirRota('/api/v1/atividades/{id}/historico');
const ANEXOS = exigirRota('/api/v1/atividades/{id}/anexos');
const ANEXO = exigirRota('/api/v1/atividades/{id}/anexos/{anexoId}');

function montarFormulario(
  ...arquivos: ReadonlyArray<[nome: string, conteudo: Uint8Array]>
): FormData {
  const formulario = new FormData();
  for (const [nome, conteudo] of arquivos) {
    formulario.append('arquivo', new Blob([new Uint8Array(conteudo)]), nome);
  }
  return formulario;
}

describe('API: anexos', () => {
  let banco: BancoDados;
  let token: string;
  let atividade: AtividadeApi;

  beforeEach(async () => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    token = criarTokenApiDeTeste(banco, [
      'atividades:ler',
      'atividades:escrever',
      'anexos:ler',
      'anexos:escrever',
    ]);
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
    const criada = await chamarApi(ATIVIDADES, 'POST', {
      token,
      corpo: { titulo: 'Erro na tela de fretes' },
    });
    atividade = esquemaAtividadeApi.parse(criada.corpo.dados);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  afterAll(() => {
    fs.rmSync(diretorioAnexos, { recursive: true, force: true });
  });

  function parametros(anexoId?: number) {
    return {
      id: String(atividade.id),
      ...(anexoId === undefined ? {} : { anexoId: String(anexoId) }),
    };
  }

  async function enviar(formulario: FormData, tokenEnvio = token) {
    return chamarApi(ANEXOS, 'POST', {
      token: tokenEnvio,
      formulario,
      parametros: parametros(),
    });
  }

  it('deve gravar os arquivos, devolver o markdown das imagens e manter a versão da atividade', async () => {
    const resposta = await enviar(
      montarFormulario(
        ['print da tela.png', CONTEUDOS_ANEXO.png],
        ['notas.txt', CONTEUDOS_ANEXO.texto],
      ),
    );

    expect(resposta.status).toBe(201);
    const anexos = esquemaListaAnexosApi.parse(resposta.corpo.dados);
    expect(anexos).toEqual([
      expect.objectContaining({
        nome: 'print da tela.png',
        tipoConteudo: 'image/png',
        imagem: true,
        markdown: `![print da tela.png](anexo:${anexos[0]?.id})`,
      }),
      expect.objectContaining({
        nome: 'notas.txt',
        tipoConteudo: 'text/plain',
        imagem: false,
        markdown: null,
      }),
    ]);
    const lida = await chamarApi(ATIVIDADE, 'GET', {
      token,
      parametros: parametros(),
    });
    expect(esquemaAtividadeApi.parse(lida.corpo.dados).versao).toBe(
      atividade.versao,
    );
    const listados = await chamarApi(ANEXOS, 'GET', {
      token,
      parametros: parametros(),
    });
    expect(esquemaListaAnexosApi.parse(listados.corpo.dados)).toEqual(anexos);
  });

  it('deve aceitar o markdown devolvido na descrição e registrar o envio no histórico com o nome do token', async () => {
    const enviado = await enviar(
      montarFormulario(['print.png', CONTEUDOS_ANEXO.png]),
    );
    const [anexo] = esquemaListaAnexosApi.parse(enviado.corpo.dados);
    const descricao = `Veja o erro:\n\n${anexo?.markdown}`;

    const atualizada = await chamarApi(ATIVIDADE, 'PATCH', {
      token,
      corpo: { versaoEsperada: atividade.versao, descricao },
      parametros: parametros(),
    });
    const historico = await chamarApi(HISTORICO, 'GET', {
      token,
      parametros: parametros(),
    });

    expect(atualizada.status).toBe(200);
    expect(esquemaAtividadeApi.parse(atualizada.corpo.dados).descricao).toBe(
      descricao,
    );
    const { eventos } = esquemaHistoricoApi.parse(historico.corpo.dados);
    expect(
      eventos.find((evento) => evento.tipo === 'anexo-adicionado'),
    ).toEqual(
      expect.objectContaining({
        origem: 'api',
        autor: 'Agente de teste',
        alteracoes: [{ campo: 'anexo', antes: null, depois: 'print.png' }],
      }),
    );
  });

  it('deve devolver o conteúdo com o tipo gravado e os cabeçalhos de arquivo privado', async () => {
    const enviado = await enviar(
      montarFormulario(['print.png', CONTEUDOS_ANEXO.png]),
    );
    const [anexo] = esquemaListaAnexosApi.parse(enviado.corpo.dados);

    const resposta = await chamarApi(ANEXO, 'GET', {
      token,
      parametros: parametros(anexo?.id),
    });

    expect(resposta.status).toBe(200);
    expect(resposta.bytes).toEqual(CONTEUDOS_ANEXO.png);
    expect(resposta.cabecalhos.get('content-type')).toBe('image/png');
    expect(resposta.cabecalhos.get('content-disposition')).toContain(
      'attachment',
    );
    expect(resposta.cabecalhos.get('x-content-type-options')).toBe('nosniff');
    expect(resposta.cabecalhos.get('cache-control')).toBe('private, no-store');
  });

  it('não deve alcançar anexo de outra atividade pelo caminho', async () => {
    const enviado = await enviar(
      montarFormulario(['print.png', CONTEUDOS_ANEXO.png]),
    );
    const [anexo] = esquemaListaAnexosApi.parse(enviado.corpo.dados);
    const outra = await chamarApi(ATIVIDADES, 'POST', {
      token,
      corpo: { titulo: 'Outra atividade' },
    });
    const outraId = String(esquemaAtividadeApi.parse(outra.corpo.dados).id);

    const lido = await chamarApi(ANEXO, 'GET', {
      token,
      parametros: { id: outraId, anexoId: String(anexo?.id) },
    });
    const removido = await chamarApi(ANEXO, 'DELETE', {
      token,
      parametros: { id: outraId, anexoId: String(anexo?.id) },
    });

    expect(lido.status).toBe(404);
    expect(lido.corpo.erro?.codigo).toBe('anexo-inexistente');
    expect(removido.status).toBe(404);
  });

  it('deve remover o anexo, que deixa de ser listado e lido', async () => {
    const enviado = await enviar(
      montarFormulario(['print.png', CONTEUDOS_ANEXO.png]),
    );
    const [anexo] = esquemaListaAnexosApi.parse(enviado.corpo.dados);

    const removido = await chamarApi(ANEXO, 'DELETE', {
      token,
      parametros: parametros(anexo?.id),
    });
    const listados = await chamarApi(ANEXOS, 'GET', {
      token,
      parametros: parametros(),
    });
    const lido = await chamarApi(ANEXO, 'GET', {
      token,
      parametros: parametros(anexo?.id),
    });

    expect(removido.status).toBe(200);
    expect(removido.corpo.dados).toEqual({ anexoId: anexo?.id });
    expect(listados.corpo.dados).toEqual([]);
    expect(lido.status).toBe(404);
  });

  it('deve exigir as permissões de anexos', async () => {
    const semAnexos = criarTokenApiDeTeste(banco, [
      'atividades:ler',
      'atividades:escrever',
    ]);

    const envio = await enviar(
      montarFormulario(['print.png', CONTEUDOS_ANEXO.png]),
      semAnexos,
    );
    const lista = await chamarApi(ANEXOS, 'GET', {
      token: semAnexos,
      parametros: parametros(),
    });

    expect(envio.status).toBe(403);
    expect(envio.corpo.erro?.mensagem).toContain('anexos:escrever');
    expect(lista.status).toBe(403);
  });

  it('deve recusar corpo que não é multipart, campo desconhecido e tipo fora do catálogo', async () => {
    const json = await chamarApi(ANEXOS, 'POST', {
      token,
      corpo: { arquivo: 'print.png' },
      parametros: parametros(),
    });
    const campoErrado = new FormData();
    campoErrado.append(
      'arquivos',
      new Blob([new Uint8Array(CONTEUDOS_ANEXO.png)]),
      'a.png',
    );
    const desconhecido = await enviar(campoErrado);
    const executavel = await enviar(
      montarFormulario(['instalador.exe', CONTEUDOS_ANEXO.executavel]),
    );
    const vazio = await enviar(new FormData());

    expect(json.status).toBe(415);
    expect(desconhecido.status).toBe(400);
    expect(desconhecido.corpo.erro?.mensagem).toContain('arquivos');
    expect(executavel.corpo.erro?.codigo).toBe('tipo-arquivo-nao-permitido');
    expect(vazio.corpo.erro?.codigo).toBe('arquivo-ausente');
    const listados = await chamarApi(ANEXOS, 'GET', {
      token,
      parametros: parametros(),
    });
    expect(listados.corpo.dados).toEqual([]);
  });

  it('deve recusar envio acima do limite antes de ler os arquivos', async () => {
    const resposta = await enviar(
      montarFormulario([
        'grande.txt',
        new Uint8Array(LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES + 1024 * 1024),
      ]),
    );

    expect(resposta.status).toBe(413);
    expect(resposta.corpo.erro?.codigo).toBe('envio-grande-demais');
  });

  it('deve recusar envio para atividade arquivada', async () => {
    await chamarApi(ARQUIVAR, 'POST', {
      token,
      corpo: { versaoEsperada: atividade.versao },
      parametros: parametros(),
    });

    const resposta = await enviar(
      montarFormulario(['print.png', CONTEUDOS_ANEXO.png]),
    );

    expect(resposta.status).toBe(409);
    expect(resposta.corpo.erro?.codigo).toBe('atividade-arquivada');
  });
});
