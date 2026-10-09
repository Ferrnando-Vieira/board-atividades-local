import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { coletarAvisosSistema } from '@/servidor/lembretes/avisosSistema';
import { criarLembreteAvulso } from '@/servidor/lembretes/lembretesAvulsosServico';
import { definirLembrete } from '@/servidor/lembretes/lembretesServico';
import {
  codificarScriptToast,
  montarVariaveisToast,
} from '@/servidor/lembretes/toastWindows';
import {
  executarCicloVigia,
  type DependenciasVigia,
} from '@/servidor/lembretes/vigiaLembretes';
import { somarMinutos } from '@/util/DataUtils';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  criarAtividadesNoStatus,
  exigirStatusPorChave,
} from '@/tests/suporte/fabricasAtividades';

// AGORA_TESTE é 01/10/2026 12:00 em America/Sao_Paulo (15:00 UTC).
const URL_BASE = 'http://127.0.0.1:3000';
const DATA_HOJE = '2026-10-01';
const HORA_TARDE = '15:00';
const MINUTOS_APOS_HORARIO = 1;
const MINUTOS_ATRASO = 10;

describe('vigia de lembretes', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
  });

  afterEach(() => {
    // O ciclo fecha o banco que recebe; fechar duas vezes é inofensivo.
    try {
      fecharBanco(banco);
    } catch {
      // Já fechado pelo ciclo.
    }
  });

  function criarAvulso(observacao: string | null = null): number {
    return criarLembreteAvulso(
      banco,
      {
        titulo: 'Renovar licença do editor',
        observacao,
        lembreteData: DATA_HOJE,
        lembreteHora: HORA_TARDE,
      },
      AGORA_TESTE,
    ).lembreteId;
  }

  const horarioDoLembrete = somarMinutos(AGORA_TESTE, 180);

  describe('coletarAvisosSistema', () => {
    it('deve devolver o aviso do lembrete avulso vencido, com link para a página', () => {
      const lembreteId = criarAvulso('Falar com o TI');

      const avisos = coletarAvisosSistema(
        banco,
        URL_BASE,
        somarMinutos(horarioDoLembrete, MINUTOS_APOS_HORARIO),
      );

      expect(avisos).toEqual([
        {
          titulo: 'Lembrete: Renovar licença do editor',
          corpo: 'Marcado para 01/10/2026, 15:00. Falar com o TI',
          url: `${URL_BASE}/lembretes#lembrete-${lembreteId}`,
        },
      ]);
    });

    it('deve marcar como atrasado o aviso que passou da tolerância', () => {
      criarAvulso();

      const [aviso] = coletarAvisosSistema(
        banco,
        URL_BASE,
        somarMinutos(horarioDoLembrete, MINUTOS_ATRASO),
      );

      expect(aviso?.corpo).toBe(
        'Atrasado: estava marcado para 01/10/2026, 15:00.',
      );
    });

    it('deve incluir lembretes de atividade, com link para o detalhe dela', () => {
      const [atividadeId = 0] = criarAtividadesNoStatus(
        banco,
        exigirStatusPorChave(banco, 'a-fazer').id,
        ['Ligar para o financeiro'],
      );
      definirLembrete(
        banco,
        {
          atividadeId,
          versaoEsperada: 1,
          lembreteData: DATA_HOJE,
          lembreteHora: HORA_TARDE,
        },
        AGORA_TESTE,
      );

      const avisos = coletarAvisosSistema(
        banco,
        URL_BASE,
        somarMinutos(horarioDoLembrete, MINUTOS_APOS_HORARIO),
      );

      expect(avisos).toEqual([
        expect.objectContaining({
          titulo: 'Lembrete: Ligar para o financeiro',
          url: `${URL_BASE}/atividades/${atividadeId}`,
        }),
      ]);
    });

    it('deve avisar cada lembrete uma única vez', () => {
      criarAvulso();
      const depois = somarMinutos(horarioDoLembrete, MINUTOS_APOS_HORARIO);

      const primeira = coletarAvisosSistema(banco, URL_BASE, depois);
      const segunda = coletarAvisosSistema(banco, URL_BASE, depois);

      expect(primeira).toHaveLength(1);
      expect(segunda).toEqual([]);
    });

    it('não deve avisar lembrete ainda no futuro', () => {
      criarAvulso();

      expect(coletarAvisosSistema(banco, URL_BASE, AGORA_TESTE)).toEqual([]);
    });
  });

  describe('executarCicloVigia', () => {
    function montarDependencias(
      exibirAviso: DependenciasVigia['exibirAviso'],
    ): DependenciasVigia {
      return {
        abrirBanco: () => banco,
        exibirAviso,
        urlBase: URL_BASE,
        aoFalhar: jest.fn(),
      };
    }

    it('deve exibir um toast por aviso e devolver a quantidade', async () => {
      criarAvulso();
      criarAvulso();
      const exibirAviso = jest.fn().mockResolvedValue(true);

      const quantidade = await executarCicloVigia(
        montarDependencias(exibirAviso),
        somarMinutos(horarioDoLembrete, MINUTOS_APOS_HORARIO),
      );

      expect(quantidade).toBe(2);
      expect(exibirAviso).toHaveBeenCalledTimes(2);
    });

    it('não deve exibir nada quando não há lembrete vencido', async () => {
      criarAvulso();
      const exibirAviso = jest.fn();

      const quantidade = await executarCicloVigia(
        montarDependencias(exibirAviso),
        AGORA_TESTE,
      );

      expect(quantidade).toBe(0);
      expect(exibirAviso).not.toHaveBeenCalled();
    });
  });

  describe('toast do Windows', () => {
    it('deve enviar os textos por variáveis de ambiente, fora do script', () => {
      const variaveis = montarVariaveisToast({
        titulo: 'Lembrete: <b>"x"</b> & \'y\'',
        corpo: 'Marcado para 15:00.',
        url: `${URL_BASE}/lembretes`,
      });
      const script = Buffer.from(codificarScriptToast(), 'base64').toString(
        'utf16le',
      );

      expect(variaveis).toEqual({
        BOARD_TOAST_TITULO: 'Lembrete: <b>"x"</b> & \'y\'',
        BOARD_TOAST_CORPO: 'Marcado para 15:00.',
        BOARD_TOAST_URL: `${URL_BASE}/lembretes`,
      });
      expect(script).toContain('$env:BOARD_TOAST_TITULO');
      expect(script).not.toContain('<b>');
    });
  });
});
