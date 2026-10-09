import { eq } from 'drizzle-orm';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { linksCompartilhamento } from '@/servidor/banco/esquema';
import { validarTokenCompartilhamento } from '@/servidor/compartilhamento/acessoCompartilhamento';
import { revogarLinkCompartilhamento } from '@/servidor/compartilhamento/linksServico';
import { gerarTokenSeguro } from '@/servidor/seguranca/tokens';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import { AGORA_TESTE } from '@/tests/suporte/fabricasAtividades';
import {
  criarCenarioEscopo,
  criarLinkDeTeste,
  criarTokenApiDeTeste,
  exigirIdSolicitante,
  exigirIdTag,
} from '@/tests/suporte/fabricasCompartilhamento';

const UM_MINUTO_DEPOIS = new Date(AGORA_TESTE.getTime() + 60 * 1000);
const DEZ_MINUTOS_DEPOIS = new Date(AGORA_TESTE.getTime() + 10 * 60 * 1000);
const DOIS_DIAS_DEPOIS = new Date(
  AGORA_TESTE.getTime() + 2 * 24 * 60 * 60 * 1000,
);

describe('validarTokenCompartilhamento', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
    criarCenarioEscopo(banco);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function lerUltimoAcesso(linkId: number): string | null {
    return (
      banco
        .select({ ultimoAcessoEm: linksCompartilhamento.ultimoAcessoEm })
        .from(linksCompartilhamento)
        .where(eq(linksCompartilhamento.id, linkId))
        .get()?.ultimoAcessoEm ?? null
    );
  }

  it('deve devolver a restrição do link restrito com tags, solicitantes e arquivadas', () => {
    const tagId = exigirIdTag(banco, 'Faturas');
    const solicitanteId = exigirIdSolicitante(banco, 'Financeiro');
    const { token } = criarLinkDeTeste(banco, {
      tagIds: [tagId],
      solicitanteIds: [solicitanteId],
      incluirArquivadas: true,
    });

    const link = validarTokenCompartilhamento(banco, token, AGORA_TESTE);

    expect(link?.modalidade).toBe('restrito');
    expect(link?.restricao).toEqual({
      statusIds: [],
      tagIds: [tagId],
      solicitanteIds: [solicitanteId],
      prioridadeMinima: null,
      prioridadeMaxima: null,
      arquivamento: 'todas',
    });
  });

  it('deve excluir arquivadas quando o link restrito não as inclui', () => {
    const { token } = criarLinkDeTeste(banco, {
      tagIds: [exigirIdTag(banco, 'Faturas')],
    });

    const link = validarTokenCompartilhamento(banco, token, AGORA_TESTE);

    expect(link?.restricao?.arquivamento).toBe('ativas');
    expect(link?.incluirArquivadas).toBe(false);
  });

  it('não deve restringir o link completo', () => {
    const { token } = criarLinkDeTeste(banco, {
      modalidade: 'completo',
      incluirArquivadas: true,
    });

    const link = validarTokenCompartilhamento(banco, token, AGORA_TESTE);

    expect(link).toEqual(
      expect.objectContaining({
        modalidade: 'completo',
        restricao: null,
        incluirArquivadas: true,
      }),
    );
  });

  it.each([
    ['vazio', ''],
    ['curto', 'abc'],
    ['com caractere fora do base64url', `${'a'.repeat(42)}!`],
    ['não textual', 12345],
  ])('deve recusar token %s', (_descricao, token) => {
    expect(validarTokenCompartilhamento(banco, token, AGORA_TESTE)).toBeNull();
  });

  it('deve recusar token bem formado que nunca foi emitido', () => {
    expect(
      validarTokenCompartilhamento(banco, gerarTokenSeguro(), AGORA_TESTE),
    ).toBeNull();
  });

  it('deve recusar token de API usado como link', () => {
    const tokenApi = criarTokenApiDeTeste(banco, ['board:ler']);

    expect(
      validarTokenCompartilhamento(banco, tokenApi, AGORA_TESTE),
    ).toBeNull();
  });

  it('deve recusar link revogado na validação seguinte', () => {
    const link = criarLinkDeTeste(banco, { modalidade: 'completo' });
    revogarLinkCompartilhamento(banco, { linkId: link.linkId }, AGORA_TESTE);

    expect(
      validarTokenCompartilhamento(banco, link.token, UM_MINUTO_DEPOIS),
    ).toBeNull();
  });

  it('deve recusar link depois da expiração', () => {
    const { token } = criarLinkDeTeste(banco, {
      modalidade: 'completo',
      validadeDias: 1,
    });

    expect(
      validarTokenCompartilhamento(banco, token, AGORA_TESTE),
    ).not.toBeNull();
    expect(
      validarTokenCompartilhamento(banco, token, DOIS_DIAS_DEPOIS),
    ).toBeNull();
  });

  it('deve recusar link restrito que ficou sem tag e sem solicitante', () => {
    const { token } = criarLinkDeTeste(banco, { modalidade: 'restrito' });

    expect(validarTokenCompartilhamento(banco, token, AGORA_TESTE)).toBeNull();
  });

  it('deve registrar o último acesso no máximo uma vez a cada intervalo', () => {
    const { linkId, token } = criarLinkDeTeste(banco, {
      modalidade: 'completo',
    });

    validarTokenCompartilhamento(banco, token, AGORA_TESTE);
    validarTokenCompartilhamento(banco, token, UM_MINUTO_DEPOIS);
    const depoisDoIntervaloCurto = lerUltimoAcesso(linkId);
    validarTokenCompartilhamento(banco, token, DEZ_MINUTOS_DEPOIS);

    expect(depoisDoIntervaloCurto).toBe(AGORA_TESTE.toISOString());
    expect(lerUltimoAcesso(linkId)).toBe(DEZ_MINUTOS_DEPOIS.toISOString());
  });
});
