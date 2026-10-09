import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LIMITES_ANEXO } from '@/config/anexos';
import { CODIGO_CONFLITO_VERSAO } from '@/servidor/banco/concorrencia';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  anexarArquivos,
  type ArquivoPendente,
} from '@/servidor/anexos/anexosServico';
import { listarAnexosDaAtividade } from '@/servidor/anexos/consultasAnexos';
import { CODIGOS_ANEXO } from '@/servidor/anexos/validacaoAnexos';
import {
  criarAtividade,
  editarAtividade,
} from '@/servidor/atividades/atividadesServico';
import { consultarHistoricoAtividade } from '@/servidor/historico/consultasHistorico';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import {
  CONTEUDOS_ANEXO,
  montarBytesComTamanho,
} from '@/tests/suporte/fabricasAnexos';
import {
  AGORA_TESTE,
  buscarAtividadeGravada,
  exigirStatusPorChave,
  montarDadosAtividade,
} from '@/tests/suporte/fabricasAtividades';
import { inserirAnexo } from '@/tests/suporte/fabricasCompartilhamento';

const CHAVE_PRINT = 'a1b2c3d4e5f60718';
const CHAVE_OUTRO = '0f1e2d3c4b5a6978';
const BYTES_POR_MEBIBYTE = 1024 * 1024;

function imagem(chave: string, nome = `${chave}.png`): ArquivoPendente {
  return { nomeArquivo: nome, conteudo: CONTEUDOS_ANEXO.png, chave };
}

function anexoComum(nome = 'planilha.csv'): ArquivoPendente {
  return { nomeArquivo: nome, conteudo: CONTEUDOS_ANEXO.texto, chave: null };
}

describe('arquivos enviados junto com a atividade', () => {
  let banco: BancoDados;
  let diretorioAnexos: string;
  let aFazerId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    diretorioAnexos = fs.mkdtempSync(
      path.join(os.tmpdir(), 'board-arquivos-pendentes-'),
    );
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
  });

  afterEach(() => {
    fecharBanco(banco);
    fs.rmSync(diretorioAnexos, { recursive: true, force: true });
  });

  function arquivosNoDisco(): string[] {
    return fs.readdirSync(diretorioAnexos);
  }

  function criarComArquivos(
    descricao: string | null,
    arquivos: readonly ArquivoPendente[],
  ) {
    return criarAtividade(
      banco,
      montarDadosAtividade(aFazerId, { titulo: 'Erro ao salvar', descricao }),
      AGORA_TESTE,
      undefined,
      { diretorioAnexos, arquivos },
    );
  }

  describe('criação', () => {
    it('deve gravar as imagens coladas e apontar a descrição para os anexos', () => {
      const { atividadeId } = criarComArquivos(
        `Veja:\n![print](anexo-novo:${CHAVE_PRINT})\nfim`,
        [imagem(CHAVE_PRINT, 'imagem-colada.png'), anexoComum()],
      );

      const anexos = listarAnexosDaAtividade(banco, atividadeId);
      const imagemGravada = anexos.find(
        (anexo) => anexo.nomeOriginal === 'imagem-colada.png',
      );
      expect(anexos.map((anexo) => anexo.nomeOriginal)).toEqual([
        'imagem-colada.png',
        'planilha.csv',
      ]);
      expect(buscarAtividadeGravada(banco, atividadeId).descricao).toBe(
        `Veja:\n![print](anexo:${imagemGravada?.id})\nfim`,
      );
      expect(arquivosNoDisco()).toHaveLength(2);
      expect(
        consultarHistoricoAtividade(banco, atividadeId).eventos.map(
          (evento) => evento.tipo,
        ),
      ).toEqual(['anexo-adicionado', 'anexo-adicionado', 'criacao']);
    });

    it('deve recusar arquivo que não é imagem no lugar de uma imagem colada', () => {
      expect(() =>
        criarComArquivos(`![x](anexo-novo:${CHAVE_PRINT})`, [
          {
            nomeArquivo: 'relatorio.pdf',
            conteudo: CONTEUDOS_ANEXO.pdf,
            chave: CHAVE_PRINT,
          },
        ]),
      ).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_ANEXO.IMAGEM_NAO_PERMITIDA,
        }),
      );
      expect(contarLinhas(banco, 'atividades')).toBe(0);
      expect(arquivosNoDisco()).toEqual([]);
    });

    it('deve recusar chaves repetidas ou fora do formato', () => {
      expect(() =>
        criarComArquivos('texto', [imagem(CHAVE_PRINT), imagem(CHAVE_PRINT)]),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.REFERENCIA_INVALIDA }),
      );
      expect(() => criarComArquivos('texto', [imagem('../../x')])).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.REFERENCIA_INVALIDA }),
      );
      expect(arquivosNoDisco()).toEqual([]);
    });

    it('deve apagar os arquivos gravados quando a transação da atividade falhar', () => {
      banco.$client.exec(
        "CREATE TRIGGER falhar_insercao_anexo BEFORE INSERT ON anexos BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;",
      );

      expect(() =>
        criarComArquivos(`![p](anexo-novo:${CHAVE_PRINT})`, [
          imagem(CHAVE_PRINT),
        ]),
      ).toThrow('falha simulada');
      expect(contarLinhas(banco, 'atividades')).toBe(0);
      expect(contarLinhas(banco, 'historico_atividades')).toBe(0);
      expect(arquivosNoDisco()).toEqual([]);
    });

    it(`deve recusar mais de ${LIMITES_ANEXO.MAXIMO_POR_ENVIO} arquivos num envio`, () => {
      const arquivos = Array.from(
        { length: LIMITES_ANEXO.MAXIMO_POR_ENVIO + 1 },
        (_, indice) => anexoComum(`arquivo-${indice}.csv`),
      );

      expect(() => criarComArquivos(null, arquivos)).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.ARQUIVOS_DEMAIS }),
      );
      expect(arquivosNoDisco()).toEqual([]);
    });

    it('deve recusar envio que soma mais que o limite total', () => {
      const quantidade =
        Math.floor(
          LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES /
            LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES,
        ) + 1;
      const grande = montarBytesComTamanho(
        '%PDF-1.7',
        LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES - BYTES_POR_MEBIBYTE,
      );
      const arquivos = Array.from({ length: quantidade + 1 }, (_, indice) => ({
        nomeArquivo: `grande-${indice}.pdf`,
        conteudo: grande,
        chave: null,
      }));

      expect(() => criarComArquivos(null, arquivos)).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.ENVIO_GRANDE }),
      );
      expect(arquivosNoDisco()).toEqual([]);
    });
  });

  describe('edição', () => {
    it('deve gravar a imagem colada e trocar só as referências com arquivo', () => {
      const { atividadeId } = criarComArquivos('Antes', []);

      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, {
            titulo: 'Erro ao salvar',
            descricao: `Antes\n![a](anexo-novo:${CHAVE_PRINT})\n![b](anexo-novo:${CHAVE_OUTRO})`,
          }),
          atividadeId,
          versaoEsperada: 1,
        },
        AGORA_TESTE,
        undefined,
        { diretorioAnexos, arquivos: [imagem(CHAVE_PRINT)] },
      );

      const [anexo] = listarAnexosDaAtividade(banco, atividadeId);
      const descricao = buscarAtividadeGravada(banco, atividadeId).descricao;
      expect(descricao).toContain(`![a](anexo:${anexo?.id})`);
      expect(descricao).toContain(`![b](anexo-novo:${CHAVE_OUTRO})`);
      const [edicao] = consultarHistoricoAtividade(banco, atividadeId).eventos;
      expect(edicao?.alteracoes[0]).toEqual(
        expect.objectContaining({ campo: 'descricao', depois: descricao }),
      );
    });

    it('deve apagar o arquivo gravado quando a versão estiver vencida', () => {
      const { atividadeId } = criarComArquivos('Antes', []);

      expect(() =>
        editarAtividade(
          banco,
          {
            ...montarDadosAtividade(aFazerId, {
              descricao: `![a](anexo-novo:${CHAVE_PRINT})`,
            }),
            atividadeId,
            versaoEsperada: 7,
          },
          AGORA_TESTE,
          undefined,
          { diretorioAnexos, arquivos: [imagem(CHAVE_PRINT)] },
        ),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }));
      expect(arquivosNoDisco()).toEqual([]);
      expect(contarLinhas(banco, 'anexos')).toBe(0);
    });

    it('deve respeitar o limite de anexos por atividade contando os novos', () => {
      const { atividadeId } = criarComArquivos('Antes', []);
      for (
        let indice = 0;
        indice < LIMITES_ANEXO.MAXIMO_POR_ATIVIDADE - 1;
        indice += 1
      ) {
        inserirAnexo(
          banco,
          atividadeId,
          `existente_${String(indice).padStart(16, '0')}`,
        );
      }

      expect(() =>
        editarAtividade(
          banco,
          {
            ...montarDadosAtividade(aFazerId, {
              descricao: `![a](anexo-novo:${CHAVE_PRINT})\n![b](anexo-novo:${CHAVE_OUTRO})`,
            }),
            atividadeId,
            versaoEsperada: 1,
          },
          AGORA_TESTE,
          undefined,
          {
            diretorioAnexos,
            arquivos: [imagem(CHAVE_PRINT), imagem(CHAVE_OUTRO)],
          },
        ),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.LIMITE_ANEXOS }),
      );
      expect(arquivosNoDisco()).toEqual([]);
      expect(buscarAtividadeGravada(banco, atividadeId).versao).toBe(1);
    });
  });

  describe('anexarArquivos', () => {
    it('deve gravar vários arquivos de uma vez', () => {
      const { atividadeId } = criarComArquivos(null, []);

      const anexos = anexarArquivos(banco, diretorioAnexos, {
        atividadeId,
        arquivos: [anexoComum('a.csv'), anexoComum('b.csv')],
      });

      expect(anexos.map((anexo) => anexo.nomeOriginal)).toEqual([
        'a.csv',
        'b.csv',
      ]);
      expect(arquivosNoDisco()).toHaveLength(2);
    });

    it('não deve gravar nenhum arquivo se um deles for inválido', () => {
      const { atividadeId } = criarComArquivos(null, []);

      expect(() =>
        anexarArquivos(banco, diretorioAnexos, {
          atividadeId,
          arquivos: [
            anexoComum('a.csv'),
            {
              nomeArquivo: 'programa.pdf',
              conteudo: CONTEUDOS_ANEXO.executavel,
              chave: null,
            },
          ],
        }),
      ).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_ANEXO.CONTEUDO_INCOMPATIVEL,
        }),
      );
      expect(contarLinhas(banco, 'anexos')).toBe(0);
      expect(arquivosNoDisco()).toEqual([]);
    });

    it('deve recusar envio sem arquivos', () => {
      const { atividadeId } = criarComArquivos(null, []);

      expect(() =>
        anexarArquivos(banco, diretorioAnexos, { atividadeId, arquivos: [] }),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.ARQUIVO_AUSENTE }),
      );
    });
  });
});
