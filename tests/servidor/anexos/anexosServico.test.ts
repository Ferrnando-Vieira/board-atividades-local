import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LIMITES_ANEXO } from '@/config/anexos';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { anexos } from '@/servidor/banco/esquema';
import {
  anexarArquivo,
  reconciliarArquivosAnexos,
  removerAnexo,
} from '@/servidor/anexos/anexosServico';
import { abrirConteudoAnexo } from '@/servidor/anexos/armazenamentoAnexos';
import {
  consultarAnexoAutorizado,
  listarAnexosDaAtividade,
} from '@/servidor/anexos/consultasAnexos';
import { CODIGOS_ANEXO } from '@/servidor/anexos/validacaoAnexos';
import {
  CODIGO_ATIVIDADE_ARQUIVADA,
  CODIGO_ATIVIDADE_INEXISTENTE,
} from '@/servidor/atividades/atividadesRepositorio';
import { arquivarAtividade } from '@/servidor/atividades/atividadesServico';
import { criarFiltroAtividades } from '@/servidor/atividades/filtrosAtividades';
import { somarMinutos } from '@/util/DataUtils';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';
import {
  AGORA_TESTE,
  criarAtividadesNoStatus,
  exigirStatusPorChave,
} from '@/tests/suporte/fabricasAtividades';
import {
  criarCenarioEscopo,
  exigirIdTag,
  inserirAnexo,
} from '@/tests/suporte/fabricasCompartilhamento';

const NOME_ORIGINAL = 'relatório de fretes.pdf';
const ATIVIDADE_INEXISTENTE = 9999;
const IDENTIFICADOR_ORFAO = 'orfaoAntigo_0123456789abcdef';
const MINUTOS_ORFAO_ANTIGO = LIMITES_ANEXO.IDADE_MINIMA_ORFAO_MINUTOS + 5;

function listarArquivosDoDiretorio(diretorio: string): string[] {
  return fs.readdirSync(diretorio).sort();
}

async function lerConteudo(fluxo: ReadableStream<Uint8Array>) {
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

function envelhecerArquivo(caminho: string, minutos: number): void {
  const momento = somarMinutos(new Date(), -minutos);
  fs.utimesSync(caminho, momento, momento);
}

describe('anexosServico', () => {
  let banco: BancoDados;
  let diretorioAnexos: string;
  let atividadeId: number;
  let outraAtividadeId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    diretorioAnexos = fs.mkdtempSync(
      path.join(os.tmpdir(), 'board-anexos-servico-'),
    );
    [atividadeId = 0, outraAtividadeId = 0] = criarAtividadesNoStatus(
      banco,
      exigirStatusPorChave(banco, 'a-fazer').id,
      ['Conferir fretes', 'Outra atividade'],
    );
  });

  afterEach(() => {
    fecharBanco(banco);
    fs.rmSync(diretorioAnexos, { recursive: true, force: true });
  });

  function enviar(
    nomeArquivo = NOME_ORIGINAL,
    conteudo: Uint8Array = CONTEUDOS_ANEXO.pdf,
    destino = atividadeId,
  ) {
    return anexarArquivo(
      banco,
      diretorioAnexos,
      { atividadeId: destino, nomeArquivo, conteudo },
      null,
      AGORA_TESTE,
    );
  }

  describe('anexarArquivo', () => {
    it('deve gravar os bytes no diretório privado com nome interno e o metadado no banco', () => {
      const anexo = enviar();

      const registro = banco
        .select()
        .from(anexos)
        .where(eq(anexos.id, anexo.id))
        .get();
      const arquivos = listarArquivosDoDiretorio(diretorioAnexos);
      expect(registro).toEqual(
        expect.objectContaining({
          atividadeId,
          nomeOriginal: NOME_ORIGINAL,
          tipoConteudo: 'application/pdf',
          tamanhoBytes: CONTEUDOS_ANEXO.pdf.byteLength,
          removidoEm: null,
        }),
      );
      expect(arquivos).toEqual([registro?.identificadorArquivo]);
      expect(registro?.identificadorArquivo).toMatch(/^[0-9A-Za-z_-]{32}$/);
      expect(
        fs.readFileSync(path.join(diretorioAnexos, arquivos[0] ?? '')),
      ).toEqual(Buffer.from(CONTEUDOS_ANEXO.pdf));
    });

    it('deve listar o anexo enviado entre os anexos da atividade', () => {
      const anexo = enviar();

      const lista = listarAnexosDaAtividade(banco, atividadeId);

      expect(lista).toEqual([
        {
          id: anexo.id,
          nomeOriginal: NOME_ORIGINAL,
          tipoConteudo: 'application/pdf',
          tamanhoBytes: CONTEUDOS_ANEXO.pdf.byteLength,
          criadoEm: AGORA_TESTE.toISOString(),
        },
      ]);
    });

    it('deve permitir baixar exatamente o conteúdo enviado', async () => {
      const anexo = enviar();
      const autorizado = consultarAnexoAutorizado(banco, anexo.id, null);
      const conteudo = autorizado
        ? abrirConteudoAnexo(diretorioAnexos, autorizado.identificadorArquivo)
        : null;

      const bytes = conteudo ? await lerConteudo(conteudo.fluxo) : null;

      expect(bytes).toEqual(CONTEUDOS_ANEXO.pdf);
    });

    it('deve gerar arquivos distintos para envios com o mesmo nome, sem sobrescrever', () => {
      const primeiro = enviar('igual.txt', CONTEUDOS_ANEXO.texto);
      const segundo = enviar('igual.txt', CONTEUDOS_ANEXO.texto);

      const arquivos = listarArquivosDoDiretorio(diretorioAnexos);

      expect(primeiro.id).not.toBe(segundo.id);
      expect(arquivos).toHaveLength(2);
      expect(contarLinhas(banco, 'anexos')).toBe(2);
    });

    it('deve guardar só o nome final de um caminho hostil e nunca sair do diretório', () => {
      const diretorioPai = path.dirname(diretorioAnexos);
      const conteudoPaiAntes = fs.readdirSync(diretorioPai).length;

      const anexo = enviar('../../public/relatorio.pdf');

      expect(anexo.nomeOriginal).toBe('relatorio.pdf');
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toHaveLength(1);
      expect(fs.readdirSync(diretorioPai)).toHaveLength(conteudoPaiAntes);
    });

    it('deve recusar atividade inexistente sem gravar arquivo nem metadado', () => {
      expect(() =>
        enviar(NOME_ORIGINAL, CONTEUDOS_ANEXO.pdf, ATIVIDADE_INEXISTENTE),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_ATIVIDADE_INEXISTENTE }),
      );
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toEqual([]);
      expect(contarLinhas(banco, 'anexos')).toBe(0);
    });

    it('deve recusar atividade arquivada sem gravar arquivo', () => {
      arquivarAtividade(banco, { atividadeId, versaoEsperada: 1 }, AGORA_TESTE);

      expect(() => enviar()).toThrow(
        expect.objectContaining({ codigo: CODIGO_ATIVIDADE_ARQUIVADA }),
      );
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toEqual([]);
    });

    it('deve recusar tipo não permitido sem gravar arquivo', () => {
      expect(() => enviar('pagina.html', CONTEUDOS_ANEXO.texto)).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.TIPO_NAO_PERMITIDO }),
      );
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toEqual([]);
    });

    it('deve recusar atividade fora da restrição do acesso como inexistente', () => {
      const cenario = criarCenarioEscopo(banco);
      const restricao = criarFiltroAtividades({
        tagIds: [exigirIdTag(banco, 'Faturas')],
      });

      expect(() =>
        anexarArquivo(
          banco,
          diretorioAnexos,
          {
            atividadeId: cenario.outrosEu,
            nomeArquivo: NOME_ORIGINAL,
            conteudo: CONTEUDOS_ANEXO.pdf,
          },
          restricao,
          AGORA_TESTE,
        ),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_ATIVIDADE_INEXISTENTE }),
      );
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toEqual([]);
    });

    it('deve recusar o anexo além do limite por atividade', () => {
      for (
        let indice = 0;
        indice < LIMITES_ANEXO.MAXIMO_POR_ATIVIDADE;
        indice += 1
      ) {
        inserirAnexo(
          banco,
          atividadeId,
          `existente_${String(indice).padStart(16, '0')}`,
        );
      }

      expect(() => enviar()).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.LIMITE_ANEXOS }),
      );
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toEqual([]);
    });

    it('deve apagar o arquivo recém-gravado quando a transação do metadado falhar', () => {
      banco.$client.exec(
        "CREATE TRIGGER falhar_insercao_anexo BEFORE INSERT ON anexos BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;",
      );

      expect(() => enviar()).toThrow('falha simulada');
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toEqual([]);
      expect(contarLinhas(banco, 'anexos')).toBe(0);
    });
  });

  describe('removerAnexo', () => {
    it('deve marcar o anexo como removido e apagar o arquivo do disco', () => {
      const anexo = enviar();

      removerAnexo(
        banco,
        diretorioAnexos,
        { atividadeId, anexoId: anexo.id },
        null,
        AGORA_TESTE,
      );

      const registro = banco
        .select({ removidoEm: anexos.removidoEm })
        .from(anexos)
        .where(eq(anexos.id, anexo.id))
        .get();
      expect(registro?.removidoEm).toBe(AGORA_TESTE.toISOString());
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toEqual([]);
      expect(listarAnexosDaAtividade(banco, atividadeId)).toEqual([]);
      expect(consultarAnexoAutorizado(banco, anexo.id, null)).toBeNull();
    });

    it('deve recusar anexo informado com outra atividade', () => {
      const anexo = enviar();

      expect(() =>
        removerAnexo(banco, diretorioAnexos, {
          atividadeId: outraAtividadeId,
          anexoId: anexo.id,
        }),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.ANEXO_INEXISTENTE }),
      );
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toHaveLength(1);
    });

    it('deve recusar remover o mesmo anexo duas vezes', () => {
      const anexo = enviar();
      const remocao = { atividadeId, anexoId: anexo.id };
      removerAnexo(banco, diretorioAnexos, remocao);

      expect(() => removerAnexo(banco, diretorioAnexos, remocao)).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.ANEXO_INEXISTENTE }),
      );
    });

    it('deve recusar remoção em atividade arquivada mantendo o arquivo', () => {
      const anexo = enviar();
      arquivarAtividade(banco, { atividadeId, versaoEsperada: 1 }, AGORA_TESTE);

      expect(() =>
        removerAnexo(banco, diretorioAnexos, {
          atividadeId,
          anexoId: anexo.id,
        }),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_ATIVIDADE_ARQUIVADA }),
      );
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toHaveLength(1);
    });

    it('deve concluir a remoção mesmo se o arquivo já não existir no disco', () => {
      const anexo = enviar();
      for (const nome of listarArquivosDoDiretorio(diretorioAnexos)) {
        fs.rmSync(path.join(diretorioAnexos, nome));
      }

      removerAnexo(banco, diretorioAnexos, { atividadeId, anexoId: anexo.id });

      expect(listarAnexosDaAtividade(banco, atividadeId)).toEqual([]);
    });
  });

  describe('reconciliarArquivosAnexos', () => {
    it('deve apagar arquivo antigo sem metadado e manter o do anexo ativo', () => {
      enviar();
      const caminhoOrfao = path.join(diretorioAnexos, IDENTIFICADOR_ORFAO);
      fs.writeFileSync(caminhoOrfao, 'sobra de envio interrompido');
      for (const nome of listarArquivosDoDiretorio(diretorioAnexos)) {
        envelhecerArquivo(
          path.join(diretorioAnexos, nome),
          MINUTOS_ORFAO_ANTIGO,
        );
      }

      const resultado = reconciliarArquivosAnexos(banco, diretorioAnexos);

      expect(resultado).toEqual({ arquivosVerificados: 2, orfaosRemovidos: 1 });
      expect(fs.existsSync(caminhoOrfao)).toBe(false);
      expect(listarArquivosDoDiretorio(diretorioAnexos)).toHaveLength(1);
    });

    it('deve preservar arquivo recente, que pode ser de um envio em andamento', () => {
      const caminhoRecente = path.join(diretorioAnexos, IDENTIFICADOR_ORFAO);
      fs.writeFileSync(caminhoRecente, 'envio em andamento');

      const resultado = reconciliarArquivosAnexos(banco, diretorioAnexos);

      expect(resultado.orfaosRemovidos).toBe(0);
      expect(fs.existsSync(caminhoRecente)).toBe(true);
    });

    it('deve apagar o arquivo de um anexo removido que ficou no disco', () => {
      const identificador = 'removidoMasPresente_0123456789';
      const anexoId = inserirAnexo(banco, atividadeId, identificador);
      banco
        .update(anexos)
        .set({ removidoEm: AGORA_TESTE.toISOString() })
        .where(eq(anexos.id, anexoId))
        .run();
      const caminho = path.join(diretorioAnexos, identificador);
      fs.writeFileSync(caminho, 'conteudo');
      envelhecerArquivo(caminho, MINUTOS_ORFAO_ANTIGO);

      reconciliarArquivosAnexos(banco, diretorioAnexos);

      expect(fs.existsSync(caminho)).toBe(false);
    });

    it('deve ignorar itens fora do formato de identificador', () => {
      const caminhoAlheio = path.join(diretorioAnexos, 'LEIA-ME.txt');
      fs.writeFileSync(caminhoAlheio, 'arquivo de outra origem');
      envelhecerArquivo(caminhoAlheio, MINUTOS_ORFAO_ANTIGO);

      const resultado = reconciliarArquivosAnexos(banco, diretorioAnexos);

      expect(resultado).toEqual({ arquivosVerificados: 0, orfaosRemovidos: 0 });
      expect(fs.existsSync(caminhoAlheio)).toBe(true);
    });

    it('deve tratar diretório inexistente como vazio', () => {
      const resultado = reconciliarArquivosAnexos(
        banco,
        path.join(diretorioAnexos, 'nao-existe'),
      );

      expect(resultado).toEqual({ arquivosVerificados: 0, orfaosRemovidos: 0 });
    });
  });
});
