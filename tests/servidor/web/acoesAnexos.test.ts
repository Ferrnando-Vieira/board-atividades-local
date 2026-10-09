jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/server', () => ({
  connection: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/servidor/web/bancoAplicacao', () => ({
  CODIGO_BANCO_AUSENTE: 'banco-ausente',
  obterBancoAplicacao: jest.fn(),
}));

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LIMITES_ANEXO } from '@/config/anexos';
import { CAMPOS_ATIVIDADE } from '@/config/camposFormulario';
import { criarSessao } from '@/servidor/administracao/sessoes';
import { anexarArquivo } from '@/servidor/anexos/anexosServico';
import { listarAnexosDaAtividade } from '@/servidor/anexos/consultasAnexos';
import { mensagensAnexos } from '@/servidor/anexos/mensagensAnexos';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { ID_REGISTRO_UNICO } from '@/servidor/banco/esquema';
import { revogarLinkCompartilhamento } from '@/servidor/compartilhamento/linksServico';
import { consultarHistoricoAtividade } from '@/servidor/historico/consultasHistorico';
import {
  enviarAnexoFormulario,
  removerAnexoFormulario,
} from '@/servidor/web/acoes/acoesAnexos';
import {
  criarAtividadeNoQuadro,
  editarAtividadeNoDetalhe,
} from '@/servidor/web/acoes/acoesAtividades';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import {
  CAMPO_CREDENCIAL,
  montarFormularioTeste,
  REDIRECIONA_PARA_ENTRADA,
  REDIRECIONA_PARA_INDISPONIVEL,
  redirecionaParaLink,
  simularCookieSessao,
} from '@/tests/suporte/acoesServidor';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import {
  buscarAtividadeGravada,
  exigirStatusPorChave,
} from '@/tests/suporte/fabricasAtividades';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';
import {
  cadastrarAdministrador,
  criarCenarioEscopo,
  criarLinkDeTeste,
  exigirIdTag,
  USUARIO_ADMINISTRADOR_TESTE,
  type CenarioEscopo,
} from '@/tests/suporte/fabricasCompartilhamento';

const diretorioAnexos = fs.mkdtempSync(
  path.join(os.tmpdir(), 'board-acoes-anexos-'),
);
process.env.DIRETORIO_ANEXOS = diretorioAnexos;

const TOKEN_FORJADO = 'A'.repeat(43);
const CHAVE_PRINT = 'a1b2c3d4e5f60718';
const CHAVE_ESQUECIDA = '0f1e2d3c4b5a6978';
const NOME_ARQUIVO = 'comprovante.pdf';

function criarArquivo(
  conteudo: Uint8Array = CONTEUDOS_ANEXO.pdf,
  nome = NOME_ARQUIVO,
): File {
  return new File([Buffer.from(conteudo)], nome, { type: 'application/pdf' });
}

function contarArquivos(): number {
  return fs.readdirSync(diretorioAnexos).length;
}

describe('ações de anexos', () => {
  let banco: BancoDados;
  let cenario: CenarioEscopo;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    cenario = criarCenarioEscopo(banco);
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
    simularCookieSessao(undefined);
  });

  afterEach(() => {
    fecharBanco(banco);
    for (const nome of fs.readdirSync(diretorioAnexos)) {
      fs.rmSync(path.join(diretorioAnexos, nome), { force: true });
    }
  });

  afterAll(() => {
    fs.rmSync(diretorioAnexos, { recursive: true, force: true });
  });

  function enviar(campos: Record<string, string | Blob>) {
    return enviarAnexoFormulario(
      ESTADO_FORMULARIO_GESTAO_INICIAL,
      montarFormularioTeste(campos),
    );
  }

  function remover(campos: Record<string, string>) {
    return removerAnexoFormulario(
      ESTADO_FORMULARIO_GESTAO_INICIAL,
      montarFormularioTeste(campos),
    );
  }

  function anexarDiretamente(atividadeId: number): number {
    return anexarArquivo(banco, diretorioAnexos, {
      atividadeId,
      nomeArquivo: NOME_ARQUIVO,
      conteudo: CONTEUDOS_ANEXO.pdf,
    }).id;
  }

  function criarLinkRestritoFaturas(): string {
    return criarLinkDeTeste(banco, {
      modalidade: 'restrito',
      tagIds: [exigirIdTag(banco, 'Faturas')],
    }).token;
  }

  describe('com sessão do proprietário', () => {
    beforeEach(() => {
      simularCookieSessao(
        criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
      );
    });

    it('deve enviar o anexo e confirmar o envio', async () => {
      const estado = await enviar({
        atividadeId: String(cenario.outrosEu),
        arquivo: criarArquivo(),
      });

      expect(estado.mensagemSucesso).toBe(mensagensAnexos.anexoEnviado);
      expect(contarLinhas(banco, 'anexos')).toBe(1);
      expect(contarArquivos()).toBe(1);
    });

    it('deve enviar vários anexos de uma vez e registrar o autor', async () => {
      const dados = montarFormularioTeste({
        atividadeId: String(cenario.outrosEu),
      });
      dados.append('arquivo', criarArquivo(CONTEUDOS_ANEXO.pdf, 'a.pdf'));
      dados.append('arquivo', criarArquivo(CONTEUDOS_ANEXO.texto, 'b.csv'));

      const estado = await enviarAnexoFormulario(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        dados,
      );

      expect(estado.mensagemSucesso).toBe(mensagensAnexos.anexosEnviados(2));
      expect(contarArquivos()).toBe(2);
      expect(
        consultarHistoricoAtividade(banco, cenario.outrosEu).eventos[0],
      ).toEqual(
        expect.objectContaining({
          tipo: 'anexo-adicionado',
          origem: 'painel',
          autor: USUARIO_ADMINISTRADOR_TESTE,
        }),
      );
    });

    it('deve recusar arquivos demais num envio sem gravar nada', async () => {
      const dados = montarFormularioTeste({
        atividadeId: String(cenario.outrosEu),
      });
      for (
        let indice = 0;
        indice <= LIMITES_ANEXO.MAXIMO_POR_ENVIO;
        indice += 1
      ) {
        dados.append(
          'arquivo',
          criarArquivo(CONTEUDOS_ANEXO.pdf, String(indice) + '.pdf'),
        );
      }

      const estado = await enviarAnexoFormulario(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        dados,
      );

      expect(estado.mensagemErro).toBe(mensagensAnexos.arquivosDemais);
      expect(contarArquivos()).toBe(0);
    });

    it('deve remover o anexo e apagar o arquivo', async () => {
      const anexoId = anexarDiretamente(cenario.outrosEu);

      const estado = await remover({
        atividadeId: String(cenario.outrosEu),
        anexoId: String(anexoId),
      });

      expect(estado.mensagemSucesso).toBe(mensagensAnexos.anexoRemovido);
      expect(contarArquivos()).toBe(0);
    });

    it('deve pedir um arquivo quando nenhum foi escolhido', async () => {
      const estado = await enviar({
        atividadeId: String(cenario.outrosEu),
        arquivo: new File([], ''),
      });

      expect(estado.mensagemErro).toBe(mensagensAnexos.arquivoAusente);
    });

    it('deve recusar arquivo acima do limite sem gravar nada', async () => {
      const grande = new Uint8Array(LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES + 1);

      const estado = await enviar({
        atividadeId: String(cenario.outrosEu),
        arquivo: criarArquivo(grande),
      });

      expect(estado.mensagemErro).toBe(mensagensAnexos.arquivoGrande);
      expect(contarArquivos()).toBe(0);
    });

    it('deve recusar tipo não permitido sem gravar nada', async () => {
      const estado = await enviar({
        atividadeId: String(cenario.outrosEu),
        arquivo: criarArquivo(CONTEUDOS_ANEXO.texto, 'pagina.html'),
      });

      expect(estado.mensagemErro).toBe(mensagensAnexos.tipoNaoPermitido);
      expect(contarArquivos()).toBe(0);
    });

    it('deve recusar identificador de atividade malformado', async () => {
      const estado = await enviar({
        atividadeId: 'abc',
        arquivo: criarArquivo(),
      });

      expect(estado.mensagemErro).toBe(mensagensAnexos.dadosInvalidos);
      expect(contarLinhas(banco, 'anexos')).toBe(0);
    });
  });

  describe('com link de compartilhamento', () => {
    it('deve permitir ao link completo enviar e remover anexos', async () => {
      const { token } = criarLinkDeTeste(banco, { modalidade: 'completo' });

      const envio = await enviar({
        atividadeId: String(cenario.outrosEu),
        arquivo: criarArquivo(),
        [CAMPO_CREDENCIAL]: token,
      });
      const anexoId = banco.$client
        .prepare('SELECT id FROM anexos')
        .pluck()
        .get() as number;
      const remocao = await remover({
        atividadeId: String(cenario.outrosEu),
        anexoId: String(anexoId),
        [CAMPO_CREDENCIAL]: token,
      });

      expect(envio.mensagemSucesso).toBe(mensagensAnexos.anexoEnviado);
      expect(remocao.mensagemSucesso).toBe(mensagensAnexos.anexoRemovido);
      expect(contarArquivos()).toBe(0);
    });

    it('deve devolver o link restrito ao quadro sem gravar o anexo', async () => {
      const token = criarLinkRestritoFaturas();

      await expect(
        enviar({
          atividadeId: String(cenario.faturasFinanceiro),
          arquivo: criarArquivo(),
          [CAMPO_CREDENCIAL]: token,
        }),
      ).rejects.toThrow(redirecionaParaLink(token));
      expect(contarLinhas(banco, 'anexos')).toBe(0);
      expect(contarArquivos()).toBe(0);
    });

    it('deve impedir o link restrito de remover anexo, mesmo de atividade do escopo', async () => {
      const token = criarLinkRestritoFaturas();
      const anexoId = anexarDiretamente(cenario.faturasFinanceiro);

      await expect(
        remover({
          atividadeId: String(cenario.faturasFinanceiro),
          anexoId: String(anexoId),
          [CAMPO_CREDENCIAL]: token,
        }),
      ).rejects.toThrow(redirecionaParaLink(token));
      expect(contarArquivos()).toBe(1);
    });

    it('deve recusar link completo revogado sem gravar', async () => {
      const link = criarLinkDeTeste(banco, { modalidade: 'completo' });
      revogarLinkCompartilhamento(banco, { linkId: link.linkId });

      await expect(
        enviar({
          atividadeId: String(cenario.outrosEu),
          arquivo: criarArquivo(),
          [CAMPO_CREDENCIAL]: link.token,
        }),
      ).rejects.toThrow(REDIRECIONA_PARA_INDISPONIVEL);
      expect(contarArquivos()).toBe(0);
    });

    it('deve recusar token forjado sem gravar', async () => {
      await expect(
        enviar({
          atividadeId: String(cenario.outrosEu),
          arquivo: criarArquivo(),
          [CAMPO_CREDENCIAL]: TOKEN_FORJADO,
        }),
      ).rejects.toThrow(REDIRECIONA_PARA_INDISPONIVEL);
      expect(contarArquivos()).toBe(0);
    });
  });

  describe('formulário da atividade com arquivos', () => {
    beforeEach(() => {
      simularCookieSessao(
        criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
      );
    });

    function formularioAtividade(
      campos: Record<string, string>,
      arquivos: ReadonlyArray<[File, string]>,
    ): FormData {
      const dados = montarFormularioTeste({
        titulo: 'Erro ao salvar fatura',
        statusId: String(exigirStatusPorChave(banco, 'a-fazer').id),
        prioridade: '3',
        ...campos,
      });
      for (const [arquivo, chave] of arquivos) {
        dados.append(CAMPOS_ATIVIDADE.ARQUIVOS, arquivo);
        dados.append(CAMPOS_ATIVIDADE.CHAVES_ARQUIVOS, chave);
      }
      return dados;
    }

    function criarImagem(nome = 'imagem-colada.png'): File {
      return new File([Buffer.from(CONTEUDOS_ANEXO.png)], nome, {
        type: 'image/png',
      });
    }

    it('deve criar com a imagem colada e o anexo, e descartar imagem tirada do texto', async () => {
      const estado = await criarAtividadeNoQuadro(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        formularioAtividade(
          { descricao: 'Veja:\n![print](anexo-novo:' + CHAVE_PRINT + ')' },
          [
            [criarImagem(), CHAVE_PRINT],
            [criarImagem('esquecida.png'), CHAVE_ESQUECIDA],
            [criarArquivo(), ''],
          ],
        ),
      );

      const atividadeId = banco.$client
        .prepare('SELECT max(id) FROM atividades')
        .pluck()
        .get() as number;
      const anexos = listarAnexosDaAtividade(banco, atividadeId);
      expect(estado.mensagemSucesso).toBeDefined();
      expect(anexos.map((anexo) => anexo.nomeOriginal)).toEqual([
        'imagem-colada.png',
        NOME_ARQUIVO,
      ]);
      expect(buscarAtividadeGravada(banco, atividadeId).descricao).toBe(
        'Veja:\n![print](anexo:' + String(anexos[0]?.id) + ')',
      );
      expect(contarArquivos()).toBe(2);
    });

    it('deve devolver o erro do arquivo sem criar a atividade', async () => {
      const antes = contarLinhas(banco, 'atividades');
      const descricao = '![x](anexo-novo:' + CHAVE_PRINT + ')';

      const estado = await criarAtividadeNoQuadro(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        formularioAtividade({ descricao }, [[criarArquivo(), CHAVE_PRINT]]),
      );

      expect(estado.mensagemErro).toBe(mensagensAnexos.imagemNaoPermitida);
      expect(estado.valores?.descricao).toBe(descricao);
      expect(contarLinhas(banco, 'atividades')).toBe(antes);
      expect(contarArquivos()).toBe(0);
    });

    it('deve recusar arquivos e chaves desencontrados', async () => {
      const dados = formularioAtividade({ descricao: 'texto' }, []);
      dados.append(CAMPOS_ATIVIDADE.ARQUIVOS, criarImagem());

      const estado = await criarAtividadeNoQuadro(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        dados,
      );

      expect(estado.mensagemErro).toBe(mensagensAnexos.dadosInvalidos);
      expect(contarArquivos()).toBe(0);
    });

    it('deve editar no detalhe com imagem colada e registrar quem editou', async () => {
      const estado = await editarAtividadeNoDetalhe(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        formularioAtividade(
          {
            atividadeId: String(cenario.outrosEu),
            versaoEsperada: '1',
            titulo: 'Reunião sigilosa da diretoria',
            solicitante: 'Eu',
            tags: 'Diretoria',
            descricao: '![print](anexo-novo:' + CHAVE_PRINT + ')',
          },
          [[criarImagem(), CHAVE_PRINT]],
        ),
      );

      const [anexo] = listarAnexosDaAtividade(banco, cenario.outrosEu);
      expect(estado.mensagemSucesso).toBeDefined();
      expect(buscarAtividadeGravada(banco, cenario.outrosEu).descricao).toBe(
        '![print](anexo:' + String(anexo?.id) + ')',
      );
      expect(
        consultarHistoricoAtividade(banco, cenario.outrosEu).eventos[0],
      ).toEqual(
        expect.objectContaining({
          tipo: 'edicao',
          origem: 'painel',
          autor: USUARIO_ADMINISTRADOR_TESTE,
        }),
      );
    });
  });

  it('deve exigir a entrada quando não há sessão nem credencial', async () => {
    await expect(
      enviar({
        atividadeId: String(cenario.outrosEu),
        arquivo: criarArquivo(),
      }),
    ).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);
    expect(contarArquivos()).toBe(0);
  });
});
