import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { tokensApi } from '@/servidor/banco/esquema';
import { calcularHashToken } from '@/servidor/seguranca/tokens';
import { esquemaNovoTokenApi } from '@/servidor/tokensApi/esquemasTokensApi';
import {
  criarTokenApi,
  listarTokensApi,
  revogarTokenApi,
  validarTokenApi,
} from '@/servidor/tokensApi/tokensApiServico';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import { AGORA_TESTE } from '@/tests/suporte/fabricasAtividades';
import { criarLinkDeTeste } from '@/tests/suporte/fabricasCompartilhamento';

const FORMATO_TOKEN_API = /^bat_[A-Za-z0-9_-]{43}$/;
const TAMANHO_PREFIXO = 12;
const TOKEN_INEXISTENTE = 999_999;
const UM_MINUTO_DEPOIS = new Date(AGORA_TESTE.getTime() + 60 * 1000);
const DEZ_MINUTOS_DEPOIS = new Date(AGORA_TESTE.getTime() + 10 * 60 * 1000);
const DOIS_DIAS_DEPOIS = new Date(
  AGORA_TESTE.getTime() + 2 * 24 * 60 * 60 * 1000,
);

describe('tokens de API', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function emitir(
    permissoes: Parameters<typeof criarTokenApi>[1]['permissoes'],
    validadeDias: number | null = null,
  ) {
    return criarTokenApi(
      banco,
      { nome: 'Kiro', permissoes, validadeDias },
      AGORA_TESTE,
    );
  }

  describe('criarTokenApi', () => {
    it('deve emitir token com prefixo reconhecível e guardar só o hash', () => {
      const criado = emitir(['atividades:ler']);

      const linhas = banco.$client
        .prepare('SELECT * FROM tokens_api')
        .all() as Record<string, unknown>[];

      expect(criado.token).toMatch(FORMATO_TOKEN_API);
      expect(criado.prefixo).toHaveLength(TAMANHO_PREFIXO);
      expect(criado.token.startsWith(criado.prefixo)).toBe(true);
      expect(linhas[0]?.hash_token).toBe(calcularHashToken(criado.token));
      expect(JSON.stringify(linhas)).not.toContain(criado.token);
    });

    it('deve gravar as permissões escolhidas', () => {
      emitir(['atividades:escrever', 'board:ler']);

      expect(contarLinhas(banco, 'tokens_api_permissoes')).toBe(2);
    });
  });

  describe('validarTokenApi', () => {
    it('deve devolver as permissões em ordem fixa do catálogo', () => {
      const { token } = emitir(['atividades:escrever', 'board:ler']);

      expect(validarTokenApi(banco, token, AGORA_TESTE)).toEqual(
        expect.objectContaining({
          nome: 'Kiro',
          permissoes: ['board:ler', 'atividades:escrever'],
        }),
      );
    });

    it('deve recusar token forjado com o mesmo formato', () => {
      emitir(['board:ler']);

      expect(
        validarTokenApi(banco, `bat_${'a'.repeat(43)}`, AGORA_TESTE),
      ).toBeNull();
    });

    it('deve recusar token de link de compartilhamento', () => {
      const { token } = criarLinkDeTeste(banco, { modalidade: 'completo' });

      expect(validarTokenApi(banco, token, AGORA_TESTE)).toBeNull();
      expect(validarTokenApi(banco, `bat_${token}`, AGORA_TESTE)).toBeNull();
    });

    it('deve recusar token revogado imediatamente', () => {
      const { token, tokenId } = emitir(['board:ler']);

      revogarTokenApi(banco, { tokenId }, AGORA_TESTE);

      expect(validarTokenApi(banco, token, UM_MINUTO_DEPOIS)).toBeNull();
    });

    it('deve recusar token expirado', () => {
      const { token } = emitir(['board:ler'], 1);

      expect(validarTokenApi(banco, token, AGORA_TESTE)).not.toBeNull();
      expect(validarTokenApi(banco, token, DOIS_DIAS_DEPOIS)).toBeNull();
    });

    it('deve registrar o último uso no máximo uma vez a cada intervalo', () => {
      const { token } = emitir(['board:ler']);
      const lerUltimoUso = () =>
        banco
          .select({ ultimoUsoEm: tokensApi.ultimoUsoEm })
          .from(tokensApi)
          .get()?.ultimoUsoEm;

      validarTokenApi(banco, token, AGORA_TESTE);
      validarTokenApi(banco, token, UM_MINUTO_DEPOIS);
      const aposIntervaloCurto = lerUltimoUso();
      validarTokenApi(banco, token, DEZ_MINUTOS_DEPOIS);

      expect(aposIntervaloCurto).toBe(AGORA_TESTE.toISOString());
      expect(lerUltimoUso()).toBe(DEZ_MINUTOS_DEPOIS.toISOString());
    });
  });

  describe('listarTokensApi', () => {
    it('deve listar sem hash e com a situação de cada token', () => {
      const ativo = emitir(['board:ler']);
      const revogado = emitir(['atividades:ler']);
      revogarTokenApi(banco, { tokenId: revogado.tokenId }, AGORA_TESTE);

      const tokens = listarTokensApi(banco, AGORA_TESTE);

      expect(tokens.map((token) => [token.id, token.situacao])).toEqual(
        expect.arrayContaining([
          [ativo.tokenId, 'ativo'],
          [revogado.tokenId, 'revogado'],
        ]),
      );
      expect(JSON.stringify(tokens)).not.toContain('hash');
      expect(JSON.stringify(tokens)).not.toContain(ativo.token);
    });
  });

  describe('revogarTokenApi', () => {
    it('deve responder 404 para token inexistente', () => {
      expect(() =>
        revogarTokenApi(banco, { tokenId: TOKEN_INEXISTENTE }),
      ).toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  describe('esquemaNovoTokenApi', () => {
    it('deve exigir ao menos uma permissão', () => {
      const resultado = esquemaNovoTokenApi.safeParse({
        nome: 'Kiro',
        permissoes: [],
        validadeDias: '',
      });

      expect(resultado.success).toBe(false);
    });

    it('deve recusar permissão fora das oferecidas, inclusive anexos', () => {
      const resultado = esquemaNovoTokenApi.safeParse({
        nome: 'Kiro',
        permissoes: ['anexos:ler'],
        validadeDias: '',
      });

      expect(resultado.success).toBe(false);
    });

    it('deve remover permissões repetidas', () => {
      const dados = esquemaNovoTokenApi.parse({
        nome: 'Kiro',
        permissoes: ['board:ler', 'board:ler'],
        validadeDias: '30',
      });

      expect(dados).toEqual({
        nome: 'Kiro',
        permissoes: ['board:ler'],
        validadeDias: 30,
      });
    });
  });
});
