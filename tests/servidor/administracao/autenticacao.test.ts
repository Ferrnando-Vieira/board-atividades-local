import {
  BLOQUEIO_LOGIN,
  SESSAO_ADMINISTRATIVA,
} from '@/config/constantesSeguranca';
import { autenticarAdministrador } from '@/servidor/administracao/autenticacao';
import { revogarSessao, validarSessao } from '@/servidor/administracao/sessoes';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  administrador,
  ID_REGISTRO_UNICO,
  sessoesAdministrativas,
} from '@/servidor/banco/esquema';
import { gerarHashSenha } from '@/servidor/seguranca/senha';
import { calcularHashToken } from '@/servidor/seguranca/tokens';
import { somarDias, somarMinutos } from '@/util/DataUtils';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';

const AGORA = new Date('2026-10-01T15:00:00.000Z');
const USUARIO = 'proprietario';
const SENHA = 'uma frase longa e exclusiva';
const SENHA_ERRADA = 'outra frase qualquer';
const MINUTOS_APOS_BLOQUEIO = BLOQUEIO_LOGIN.DURACAO_MINUTOS + 1;
const DIAS_SEM_USO_PARA_EXPIRAR = SESSAO_ADMINISTRATIVA.DURACAO_DIAS + 1;
const DIAS_ANTES_DE_EXPIRAR = SESSAO_ADMINISTRATIVA.DURACAO_DIAS - 1;

function cadastrarAdministrador(banco: BancoDados, hashSenha: string): void {
  banco
    .insert(administrador)
    .values({
      id: ID_REGISTRO_UNICO,
      usuario: USUARIO,
      hashSenha,
      senhaAlteradaEm: AGORA.toISOString(),
    })
    .run();
}

async function errarSenha(banco: BancoDados, vezes: number) {
  for (let tentativa = 0; tentativa < vezes; tentativa += 1) {
    await autenticarAdministrador(
      banco,
      { usuario: USUARIO, senha: SENHA_ERRADA },
      AGORA,
    );
  }
}

describe('autenticacao', () => {
  let hashSenha: string;
  let banco: BancoDados;

  beforeAll(async () => {
    hashSenha = await gerarHashSenha(SENHA);
  });

  beforeEach(() => {
    banco = criarBancoInicializado();
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('autenticarAdministrador', () => {
    it('deve informar configuração pendente quando não há administrador', async () => {
      const resultado = await autenticarAdministrador(
        banco,
        { usuario: USUARIO, senha: SENHA },
        AGORA,
      );

      expect(resultado).toEqual({
        autenticado: false,
        motivo: 'configuracao-pendente',
      });
    });

    it('deve criar sessão guardando apenas o hash do token', async () => {
      cadastrarAdministrador(banco, hashSenha);

      const resultado = await autenticarAdministrador(
        banco,
        { usuario: USUARIO, senha: SENHA },
        AGORA,
      );

      if (!resultado.autenticado) {
        throw new Error('A autenticação deveria ter sido aceita.');
      }
      const sessao = banco.select().from(sessoesAdministrativas).get();
      expect(sessao?.hashToken).toBe(calcularHashToken(resultado.token));
      expect(JSON.stringify(sessao)).not.toContain(resultado.token);
    });

    it('deve recusar senha incorreta e contar a falha', async () => {
      cadastrarAdministrador(banco, hashSenha);

      const resultado = await autenticarAdministrador(
        banco,
        { usuario: USUARIO, senha: SENHA_ERRADA },
        AGORA,
      );

      expect(resultado).toEqual({
        autenticado: false,
        motivo: 'credenciais-invalidas',
      });
      expect(banco.select().from(administrador).get()?.tentativasFalhas).toBe(
        1,
      );
    });

    it('deve recusar usuário incorreto mesmo com a senha certa', async () => {
      cadastrarAdministrador(banco, hashSenha);

      const resultado = await autenticarAdministrador(
        banco,
        { usuario: 'outra-pessoa', senha: SENHA },
        AGORA,
      );

      expect(resultado.autenticado).toBe(false);
    });

    it('deve bloquear após o limite de falhas, inclusive para a senha certa', async () => {
      cadastrarAdministrador(banco, hashSenha);
      await errarSenha(banco, BLOQUEIO_LOGIN.TENTATIVAS_MAXIMAS);

      const resultado = await autenticarAdministrador(
        banco,
        { usuario: USUARIO, senha: SENHA },
        AGORA,
      );

      expect(resultado).toEqual({ autenticado: false, motivo: 'bloqueado' });
    });

    it('deve liberar o acesso depois do período de bloqueio', async () => {
      cadastrarAdministrador(banco, hashSenha);
      await errarSenha(banco, BLOQUEIO_LOGIN.TENTATIVAS_MAXIMAS);

      const resultado = await autenticarAdministrador(
        banco,
        { usuario: USUARIO, senha: SENHA },
        somarMinutos(AGORA, MINUTOS_APOS_BLOQUEIO),
      );

      expect(resultado.autenticado).toBe(true);
      expect(banco.select().from(administrador).get()?.bloqueadoAte).toBeNull();
    });
  });

  describe('validarSessao', () => {
    async function entrar(): Promise<string> {
      cadastrarAdministrador(banco, hashSenha);
      const resultado = await autenticarAdministrador(
        banco,
        { usuario: USUARIO, senha: SENHA },
        AGORA,
      );
      if (!resultado.autenticado) {
        throw new Error('A autenticação deveria ter sido aceita.');
      }
      return resultado.token;
    }

    it('deve aceitar o token de uma sessão vigente', async () => {
      const token = await entrar();

      const sessao = validarSessao(banco, token, AGORA);

      expect(sessao?.usuario).toBe(USUARIO);
    });

    it('deve recusar o token depois de todo o prazo sem uso', async () => {
      const token = await entrar();

      const sessao = validarSessao(
        banco,
        token,
        somarDias(AGORA, DIAS_SEM_USO_PARA_EXPIRAR),
      );

      expect(sessao).toBeNull();
    });

    it('deve renovar a validade a cada uso, sem prazo final', async () => {
      const token = await entrar();
      const primeiroUso = somarDias(AGORA, DIAS_ANTES_DE_EXPIRAR);
      const segundoUso = somarDias(primeiroUso, DIAS_ANTES_DE_EXPIRAR);

      const renovada = validarSessao(banco, token, primeiroUso);
      const aindaValida = validarSessao(banco, token, segundoUso);

      expect(renovada?.expiraEm).toBe(
        somarDias(
          primeiroUso,
          SESSAO_ADMINISTRATIVA.DURACAO_DIAS,
        ).toISOString(),
      );
      expect(aindaValida?.usuario).toBe(USUARIO);
    });

    it('não deve regravar a sessão a cada requisição', async () => {
      const token = await entrar();
      const logoDepois = somarMinutos(
        AGORA,
        SESSAO_ADMINISTRATIVA.INTERVALO_REGISTRO_USO_MINUTOS - 1,
      );

      const sessao = validarSessao(banco, token, logoDepois);

      expect(sessao?.expiraEm).toBe(
        somarDias(AGORA, SESSAO_ADMINISTRATIVA.DURACAO_DIAS).toISOString(),
      );
    });

    it('deve recusar o token de uma sessão revogada', async () => {
      const token = await entrar();
      revogarSessao(banco, token, AGORA);

      const sessao = validarSessao(banco, token, AGORA);

      expect(sessao).toBeNull();
    });

    it.each([undefined, '', 'token-desconhecido', 'x'.repeat(500)])(
      'deve recusar token ausente, desconhecido ou grande demais (%p)',
      async (tokenInvalido) => {
        await entrar();

        const sessao = validarSessao(banco, tokenInvalido, AGORA);

        expect(sessao).toBeNull();
      },
    );
  });
});
