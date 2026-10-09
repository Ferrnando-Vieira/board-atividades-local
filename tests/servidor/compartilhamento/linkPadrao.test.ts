import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TAMANHO_TOKEN_ALEATORIO } from '@/config/constantesSeguranca';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { consultarQuadro } from '@/servidor/board/consultaQuadro';
import { validarTokenCompartilhamento } from '@/servidor/compartilhamento/acessoCompartilhamento';
import {
  lerChaveLinks,
  obterOuCriarChaveLinks,
  resolverCaminhoChaveLinks,
} from '@/servidor/compartilhamento/chaveLinks';
import {
  consultarLinkPadrao,
  garantirLinkPadrao,
  NOME_LINK_PADRAO,
  renovarLinkPadrao,
} from '@/servidor/compartilhamento/linkPadrao';
import {
  listarLinksCompartilhamento,
  revogarLinkCompartilhamento,
} from '@/servidor/compartilhamento/linksServico';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import { AGORA_TESTE, exigirBoardId } from '@/tests/suporte/fabricasAtividades';
import {
  criarCenarioEscopo,
  TITULOS_CENARIO,
} from '@/tests/suporte/fabricasCompartilhamento';

const CHAVE_TESTE = Buffer.alloc(32, 1);
const OUTRA_CHAVE = Buffer.alloc(32, 2);

describe('link padrão de visualização', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('garantirLinkPadrao', () => {
    it('deve criar um link somente leitura, sem escopo e sem expiração', () => {
      const link = garantirLinkPadrao(banco, CHAVE_TESTE, AGORA_TESTE);

      const [resumo] = listarLinksCompartilhamento(
        banco,
        exigirBoardId(banco),
        AGORA_TESTE,
      );
      expect(link.criado).toBe(true);
      expect(link.token).toHaveLength(TAMANHO_TOKEN_ALEATORIO);
      expect(resumo).toEqual(
        expect.objectContaining({
          nome: NOME_LINK_PADRAO,
          modalidade: 'restrito',
          padrao: true,
          incluirArquivadas: false,
          expiraEm: null,
          tags: [],
          solicitantes: [],
          situacao: 'ativo',
        }),
      );
    });

    it('deve reaproveitar o link ativo sem gerar outro token', () => {
      const primeiro = garantirLinkPadrao(banco, CHAVE_TESTE, AGORA_TESTE);

      const segundo = garantirLinkPadrao(banco, CHAVE_TESTE, AGORA_TESTE);

      expect(segundo).toEqual({ ...primeiro, criado: false });
      expect(
        listarLinksCompartilhamento(banco, exigirBoardId(banco), AGORA_TESTE),
      ).toHaveLength(1);
    });

    it('deve criar outro link depois que o padrão for revogado', () => {
      const revogado = garantirLinkPadrao(banco, CHAVE_TESTE, AGORA_TESTE);
      revogarLinkCompartilhamento(
        banco,
        { linkId: revogado.linkId },
        AGORA_TESTE,
      );

      const novo = garantirLinkPadrao(banco, CHAVE_TESTE, AGORA_TESTE);

      expect(novo.criado).toBe(true);
      expect(novo.token).not.toBe(revogado.token);
      expect(validarTokenCompartilhamento(banco, revogado.token)).toBeNull();
    });

    it('deve revogar e substituir o link quando a chave muda', () => {
      const antigo = garantirLinkPadrao(banco, CHAVE_TESTE, AGORA_TESTE);

      const novo = garantirLinkPadrao(banco, OUTRA_CHAVE, AGORA_TESTE);

      expect(novo.criado).toBe(true);
      expect(validarTokenCompartilhamento(banco, antigo.token)).toBeNull();
      expect(validarTokenCompartilhamento(banco, novo.token)).not.toBeNull();
    });
  });

  describe('acesso pelo link', () => {
    it('deve ver o board inteiro, inclusive sem tags, só com as ativas e sem gestão', () => {
      criarCenarioEscopo(banco);
      const { token } = garantirLinkPadrao(banco, CHAVE_TESTE, AGORA_TESTE);

      const validado = validarTokenCompartilhamento(banco, token);
      const titulos = consultarQuadro(
        banco,
        AGORA_TESTE,
        validado?.restricao ?? null,
      )?.colunas.flatMap((coluna) =>
        coluna.atividades.map((cartao) => cartao.titulo),
      );

      expect(validado).toEqual(
        expect.objectContaining({
          modalidade: 'restrito',
          incluirArquivadas: false,
        }),
      );
      expect(validado?.restricao).toEqual(
        expect.objectContaining({ arquivamento: 'ativas' }),
      );
      expect(titulos).toEqual(
        expect.arrayContaining([
          TITULOS_CENARIO.semTagsFinanceiro,
          TITULOS_CENARIO.outrosEu,
          TITULOS_CENARIO.faturasBugsEu,
        ]),
      );
      expect(titulos).not.toContain(TITULOS_CENARIO.arquivadaFaturasFinanceiro);
    });
  });

  describe('consultarLinkPadrao e renovarLinkPadrao', () => {
    it('deve reconstruir o endereço só com a chave que gerou o link', () => {
      const { token, linkId } = garantirLinkPadrao(banco, CHAVE_TESTE);

      expect(
        consultarLinkPadrao(banco, exigirBoardId(banco), CHAVE_TESTE),
      ).toEqual({ linkId, token });
      expect(
        consultarLinkPadrao(banco, exigirBoardId(banco), OUTRA_CHAVE),
      ).toBeNull();
    });

    it('deve trocar o endereço e invalidar o anterior na mesma operação', () => {
      const anterior = garantirLinkPadrao(banco, CHAVE_TESTE, AGORA_TESTE);

      const renovado = renovarLinkPadrao(banco, CHAVE_TESTE, AGORA_TESTE);

      expect(renovado.token).not.toBe(anterior.token);
      expect(validarTokenCompartilhamento(banco, anterior.token)).toBeNull();
      expect(
        consultarLinkPadrao(banco, exigirBoardId(banco), CHAVE_TESTE)?.token,
      ).toBe(renovado.token);
    });
  });

  describe('garantias do banco', () => {
    it('deve recusar link padrão que permita edição ou inclua arquivadas', () => {
      const inserir = (modalidade: string, incluirArquivadas: number) =>
        banco.$client
          .prepare(
            `INSERT INTO links_compartilhamento (board_id, nome, modalidade, hash_token, incluir_arquivadas, padrao) VALUES (1, 'x', ?, ?, ?, 1)`,
          )
          .run(modalidade, 'f'.repeat(64), incluirArquivadas);

      expect(() => inserir('completo', 0)).toThrow(/CHECK/);
      expect(() => inserir('restrito', 1)).toThrow(/CHECK/);
    });

    it('deve impedir dois links padrão ativos no mesmo board', () => {
      garantirLinkPadrao(banco, CHAVE_TESTE);

      expect(() =>
        banco.$client
          .prepare(
            `INSERT INTO links_compartilhamento (board_id, nome, modalidade, hash_token, padrao) VALUES (1, 'outro', 'restrito', ?, 1)`,
          )
          .run('9'.repeat(64)),
      ).toThrow(/UNIQUE/);
    });
  });

  describe('arquivo da chave', () => {
    let diretorio: string;
    let caminho: string;

    beforeEach(() => {
      diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'board-chave-'));
      caminho = resolverCaminhoChaveLinks(path.join(diretorio, 'board.sqlite'));
    });

    afterEach(() => {
      fs.rmSync(diretorio, { recursive: true, force: true });
    });

    it('deve ficar ao lado do banco, fora dele', () => {
      expect(path.dirname(caminho)).toBe(diretorio);
    });

    it('deve criar a chave uma vez e devolver sempre a mesma', () => {
      expect(lerChaveLinks(caminho)).toBeNull();

      const criada = obterOuCriarChaveLinks(caminho);

      expect(obterOuCriarChaveLinks(caminho).equals(criada)).toBe(true);
      expect(lerChaveLinks(caminho)?.equals(criada)).toBe(true);
    });

    it('deve substituir um arquivo de chave corrompido', () => {
      fs.writeFileSync(caminho, 'conteudo-invalido');

      const chave = obterOuCriarChaveLinks(caminho);

      expect(chave).toHaveLength(32);
      expect(lerChaveLinks(caminho)?.equals(chave)).toBe(true);
    });
  });
});
