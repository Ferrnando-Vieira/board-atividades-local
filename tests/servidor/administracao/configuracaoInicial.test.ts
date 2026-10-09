import { CODIGO_CONFIGURACAO_INICIAL } from '@/config/constantesSeguranca';
import {
  concluirConfiguracaoInicial,
  emitirCodigoConfiguracao,
  existeAdministrador,
} from '@/servidor/administracao/configuracaoInicial';
import {
  esquemaConfiguracaoInicial,
  type DadosConfiguracaoInicial,
} from '@/servidor/administracao/esquemasAdministracao';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { garantirBoardPadrao } from '@/servidor/board/boardRepositorio';
import { buscarSolicitantePadrao } from '@/servidor/classificacao/classificacaoRepositorio';
import {
  administrador,
  codigoConfiguracaoInicial,
} from '@/servidor/banco/esquema';
import { verificarSenha } from '@/servidor/seguranca/senha';
import { calcularHashToken } from '@/servidor/seguranca/tokens';
import { somarMinutos } from '@/util/DataUtils';
import { contarLinhas, criarBancoMigrado } from '@/tests/suporte/bancoTeste';

const AGORA = new Date('2026-10-01T15:00:00.000Z');
const USUARIO = 'proprietario';
const SOLICITANTE_PADRAO = 'Maria Exemplo';
const SENHA = 'uma frase longa e exclusiva';
const CODIGO_ERRADO = '0000-0000-0000-0000';
const MINUTOS_APOS_EXPIRAR = CODIGO_CONFIGURACAO_INICIAL.VALIDADE_MINUTOS + 1;

function montarDados(codigo: string): DadosConfiguracaoInicial {
  return {
    codigo,
    usuario: USUARIO,
    senha: SENHA,
    confirmacaoSenha: SENHA,
    solicitantePadrao: SOLICITANTE_PADRAO,
  };
}

describe('configuracaoInicial', () => {
  let banco: BancoDados;
  let boardId: number;

  // Estado de uma instalação nova: board criado por "npm run inicializar",
  // ainda sem solicitante padrão.
  beforeEach(() => {
    banco = criarBancoMigrado();
    boardId = garantirBoardPadrao(banco).boardId;
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('emitirCodigoConfiguracao', () => {
    it('deve guardar apenas o hash do código emitido', () => {
      const { codigo } = emitirCodigoConfiguracao(banco, AGORA);

      const registro = banco.select().from(codigoConfiguracaoInicial).get();
      expect(registro?.hashCodigo).toBe(calcularHashToken(codigo));
      expect(JSON.stringify(registro)).not.toContain(codigo);
    });

    it('deve invalidar o código anterior ao emitir outro', async () => {
      const anterior = emitirCodigoConfiguracao(banco, AGORA);
      emitirCodigoConfiguracao(banco, AGORA);

      await expect(
        concluirConfiguracaoInicial(banco, montarDados(anterior.codigo), AGORA),
      ).rejects.toMatchObject({ codigo: 'codigo-invalido' });
    });

    it('deve recusar a emissão quando o administrador já existe', async () => {
      const { codigo } = emitirCodigoConfiguracao(banco, AGORA);
      await concluirConfiguracaoInicial(banco, montarDados(codigo), AGORA);

      expect(() => emitirCodigoConfiguracao(banco, AGORA)).toThrow(
        expect.objectContaining({ codigo: 'configuracao-concluida' }),
      );
    });
  });

  describe('concluirConfiguracaoInicial', () => {
    it('deve criar o administrador com hash scrypt e consumir o código', async () => {
      const { codigo } = emitirCodigoConfiguracao(banco, AGORA);

      await concluirConfiguracaoInicial(banco, montarDados(codigo), AGORA);

      const cadastro = banco.select().from(administrador).get();
      expect(cadastro?.usuario).toBe(USUARIO);
      expect(cadastro?.hashSenha.startsWith('scrypt$')).toBe(true);
      expect(cadastro?.hashSenha).not.toContain(SENHA);
      expect(await verificarSenha(SENHA, cadastro?.hashSenha ?? '')).toBe(true);
      expect(contarLinhas(banco, 'codigo_configuracao_inicial')).toBe(0);
    });

    it('deve definir o solicitante padrão informado', async () => {
      const { codigo } = emitirCodigoConfiguracao(banco, AGORA);

      await concluirConfiguracaoInicial(banco, montarDados(codigo), AGORA);

      expect(buscarSolicitantePadrao(banco, boardId)?.nome).toBe(
        SOLICITANTE_PADRAO,
      );
      expect(contarLinhas(banco, 'solicitantes')).toBe(1);
    });

    it('deve aceitar o código digitado em minúsculas e sem hífens', async () => {
      const { codigo } = emitirCodigoConfiguracao(banco, AGORA);
      const digitado = codigo.replaceAll('-', '').toLowerCase();

      await concluirConfiguracaoInicial(banco, montarDados(digitado), AGORA);

      expect(existeAdministrador(banco)).toBe(true);
    });

    it('deve recusar sem código emitido e não criar administrador', async () => {
      await expect(
        concluirConfiguracaoInicial(banco, montarDados(CODIGO_ERRADO), AGORA),
      ).rejects.toMatchObject({ codigo: 'codigo-ausente' });

      expect(existeAdministrador(banco)).toBe(false);
    });

    it('deve recusar código incorreto e contar a tentativa', async () => {
      emitirCodigoConfiguracao(banco, AGORA);

      await expect(
        concluirConfiguracaoInicial(banco, montarDados(CODIGO_ERRADO), AGORA),
      ).rejects.toMatchObject({ codigo: 'codigo-invalido' });

      const registro = banco.select().from(codigoConfiguracaoInicial).get();
      expect(registro?.tentativasFalhas).toBe(1);
      expect(existeAdministrador(banco)).toBe(false);
      expect(contarLinhas(banco, 'solicitantes')).toBe(0);
    });

    it('deve invalidar o código após o limite de tentativas incorretas', async () => {
      const { codigo } = emitirCodigoConfiguracao(banco, AGORA);
      for (
        let tentativa = 1;
        tentativa < CODIGO_CONFIGURACAO_INICIAL.TENTATIVAS_MAXIMAS;
        tentativa += 1
      ) {
        await expect(
          concluirConfiguracaoInicial(banco, montarDados(CODIGO_ERRADO), AGORA),
        ).rejects.toMatchObject({ codigo: 'codigo-invalido' });
      }

      await expect(
        concluirConfiguracaoInicial(banco, montarDados(CODIGO_ERRADO), AGORA),
      ).rejects.toMatchObject({ codigo: 'codigo-bloqueado' });

      await expect(
        concluirConfiguracaoInicial(banco, montarDados(codigo), AGORA),
      ).rejects.toMatchObject({ codigo: 'codigo-ausente' });
    });

    it('deve recusar código expirado', async () => {
      const { codigo } = emitirCodigoConfiguracao(banco, AGORA);
      const depoisDeExpirar = somarMinutos(AGORA, MINUTOS_APOS_EXPIRAR);

      await expect(
        concluirConfiguracaoInicial(
          banco,
          montarDados(codigo),
          depoisDeExpirar,
        ),
      ).rejects.toMatchObject({ codigo: 'codigo-expirado' });

      expect(existeAdministrador(banco)).toBe(false);
    });

    it('deve recusar uma segunda configuração quando já existe administrador', async () => {
      const { codigo } = emitirCodigoConfiguracao(banco, AGORA);
      await concluirConfiguracaoInicial(banco, montarDados(codigo), AGORA);

      await expect(
        concluirConfiguracaoInicial(banco, montarDados(codigo), AGORA),
      ).rejects.toMatchObject({ codigo: 'configuracao-concluida' });

      expect(contarLinhas(banco, 'administrador')).toBe(1);
    });
  });

  describe('esquemaConfiguracaoInicial', () => {
    it('deve normalizar o usuário para minúsculas sem espaços', () => {
      const resultado = esquemaConfiguracaoInicial.parse({
        ...montarDados('ABCD-EFGH-JKMN-PQRS'),
        usuario: '  Proprietario  ',
      });

      expect(resultado.usuario).toBe(USUARIO);
    });

    it('deve recusar senha mais curta que o mínimo', () => {
      const resultado = esquemaConfiguracaoInicial.safeParse({
        ...montarDados('ABCD-EFGH-JKMN-PQRS'),
        senha: 'curta',
        confirmacaoSenha: 'curta',
      });

      expect(resultado.success).toBe(false);
    });

    it('deve recusar confirmação diferente da senha', () => {
      const resultado = esquemaConfiguracaoInicial.safeParse({
        ...montarDados('ABCD-EFGH-JKMN-PQRS'),
        confirmacaoSenha: `${SENHA} diferente`,
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual(['confirmacaoSenha']);
    });

    it('deve recusar usuário com caracteres fora do formato permitido', () => {
      const resultado = esquemaConfiguracaoInicial.safeParse({
        ...montarDados('ABCD-EFGH-JKMN-PQRS'),
        usuario: 'nome com espaco',
      });

      expect(resultado.success).toBe(false);
    });

    it('deve normalizar os espaços do solicitante padrão', () => {
      const resultado = esquemaConfiguracaoInicial.parse({
        ...montarDados('ABCD-EFGH-JKMN-PQRS'),
        solicitantePadrao: '  Maria    Exemplo ',
      });

      expect(resultado.solicitantePadrao).toBe(SOLICITANTE_PADRAO);
    });

    it('deve exigir o solicitante padrão', () => {
      const resultado = esquemaConfiguracaoInicial.safeParse({
        ...montarDados('ABCD-EFGH-JKMN-PQRS'),
        solicitantePadrao: '   ',
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual(['solicitantePadrao']);
    });
  });
});
