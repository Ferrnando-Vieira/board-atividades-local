import { LEMBRETES } from '@/config/constantes';
import {
  AMBIENTE_SEM_NOTIFICACOES,
  avaliarNotificacoesNavegador,
  exibirNotificacaoNavegador,
  filtrarNaoExibidas,
  lerAmbienteNotificacoes,
  lerChavesExibidas,
  obterArmazenamentoLocal,
  registrarChaveExibida,
  solicitarPermissaoNotificacoes,
  type AmbienteNotificacoes,
  type ApiNotificacoes,
  type ArmazenamentoChaves,
} from '@/screens/lembretes/notificacoesNavegador';

const CHAVE_ARMAZENAMENTO = 'board-atividades:lembretes-exibidos';
const CONTEUDO = {
  chave: '7@2026-10-02T12:30:00.000Z',
  titulo: 'Lembrete: Ligar para o financeiro',
  corpo: 'Marcado para 02/10/2026 09:30.',
};

type NotificacaoCriada = { titulo: string; opcoes?: NotificationOptions };

type ApiFalsa = {
  api: ApiNotificacoes;
  criadas: NotificacaoCriada[];
  pedidos: () => number;
};

function criarApiFalsa(
  permissaoInicial: NotificationPermission,
  respostaPedido: NotificationPermission | Error = 'granted',
  construtorFalha = false,
): ApiFalsa {
  const criadas: NotificacaoCriada[] = [];
  let pedidos = 0;
  class NotificacaoFalsa {
    static permission: NotificationPermission = permissaoInicial;

    static async requestPermission(): Promise<NotificationPermission> {
      pedidos += 1;
      if (respostaPedido instanceof Error) {
        throw respostaPedido;
      }
      NotificacaoFalsa.permission = respostaPedido;
      return respostaPedido;
    }

    onclick: Notification['onclick'] = null;

    constructor(titulo: string, opcoes?: NotificationOptions) {
      if (construtorFalha) {
        throw new TypeError('Illegal constructor');
      }
      criadas.push({ titulo, opcoes });
    }
  }
  return { api: NotificacaoFalsa, criadas, pedidos: () => pedidos };
}

function ambienteCom(
  api: ApiNotificacoes,
  contextoSeguro = true,
): AmbienteNotificacoes {
  return { contextoSeguro, api };
}

function criarArmazenamento(
  inicial: Record<string, string> = {},
): ArmazenamentoChaves & { valores: Map<string, string> } {
  const valores = new Map(Object.entries(inicial));
  return {
    valores,
    getItem: (chave) => valores.get(chave) ?? null,
    setItem: (chave, valor) => {
      valores.set(chave, valor);
    },
  };
}

describe('notificacoesNavegador', () => {
  describe('avaliarNotificacoesNavegador', () => {
    it('deve indicar indisponível quando o navegador não tem a Notification API', () => {
      const situacao = avaliarNotificacoesNavegador(AMBIENTE_SEM_NOTIFICACOES);

      expect(situacao).toBe('indisponivel');
    });

    it('deve indicar contexto inseguro fora de HTTPS ou localhost', () => {
      const { api } = criarApiFalsa('granted');

      const situacao = avaliarNotificacoesNavegador(ambienteCom(api, false));

      expect(situacao).toBe('contexto-inseguro');
    });

    it.each([
      ['default', 'nao-solicitada'],
      ['granted', 'concedida'],
      ['denied', 'negada'],
    ] as const)('deve traduzir a permissão %s em %s', (permissao, esperada) => {
      const { api } = criarApiFalsa(permissao);

      const situacao = avaliarNotificacoesNavegador(ambienteCom(api));

      expect(situacao).toBe(esperada);
    });
  });

  describe('solicitarPermissaoNotificacoes', () => {
    it('deve pedir a permissão uma vez quando ainda não foi solicitada', async () => {
      const falsa = criarApiFalsa('default', 'granted');

      const situacao = await solicitarPermissaoNotificacoes(
        ambienteCom(falsa.api),
      );

      expect(situacao).toBe('concedida');
      expect(falsa.pedidos()).toBe(1);
    });

    it('não deve pedir de novo quando a permissão já foi negada', async () => {
      const falsa = criarApiFalsa('denied');

      const situacao = await solicitarPermissaoNotificacoes(
        ambienteCom(falsa.api),
      );

      expect(situacao).toBe('negada');
      expect(falsa.pedidos()).toBe(0);
    });

    it('não deve pedir permissão fora de contexto seguro', async () => {
      const falsa = criarApiFalsa('default');

      const situacao = await solicitarPermissaoNotificacoes(
        ambienteCom(falsa.api, false),
      );

      expect(situacao).toBe('contexto-inseguro');
      expect(falsa.pedidos()).toBe(0);
    });

    it('deve tratar falha no pedido como permissão negada', async () => {
      const falsa = criarApiFalsa('default', new Error('bloqueado'));

      const situacao = await solicitarPermissaoNotificacoes(
        ambienteCom(falsa.api),
      );

      expect(situacao).toBe('negada');
    });

    it('deve devolver indisponível sem API', async () => {
      const situacao = await solicitarPermissaoNotificacoes(
        AMBIENTE_SEM_NOTIFICACOES,
      );

      expect(situacao).toBe('indisponivel');
    });
  });

  describe('exibirNotificacaoNavegador', () => {
    it('deve exibir com a chave do aviso como tag e associar o clique', () => {
      const falsa = criarApiFalsa('granted');
      const aoClicar = jest.fn();

      const exibida = exibirNotificacaoNavegador(
        ambienteCom(falsa.api),
        CONTEUDO,
        aoClicar,
      );

      expect(exibida).toBe(true);
      expect(falsa.criadas).toEqual([
        {
          titulo: CONTEUDO.titulo,
          opcoes: { body: CONTEUDO.corpo, tag: CONTEUDO.chave, lang: 'pt-BR' },
        },
      ]);
    });

    it.each(['default', 'denied'] as const)(
      'não deve exibir com a permissão %s',
      (permissao) => {
        const falsa = criarApiFalsa(permissao);

        const exibida = exibirNotificacaoNavegador(
          ambienteCom(falsa.api),
          CONTEUDO,
        );

        expect(exibida).toBe(false);
        expect(falsa.criadas).toEqual([]);
      },
    );

    it('não deve exibir sem a API', () => {
      const exibida = exibirNotificacaoNavegador(
        AMBIENTE_SEM_NOTIFICACOES,
        CONTEUDO,
      );

      expect(exibida).toBe(false);
    });

    it('deve cair no aviso da página quando o construtor é recusado pelo navegador', () => {
      const falsa = criarApiFalsa('granted', 'granted', true);

      const exibida = exibirNotificacaoNavegador(
        ambienteCom(falsa.api),
        CONTEUDO,
      );

      expect(exibida).toBe(false);
    });
  });

  describe('lerAmbienteNotificacoes', () => {
    it('deve tratar a ausência de janela como ambiente sem notificações', () => {
      const ambiente = lerAmbienteNotificacoes(undefined);

      expect(ambiente).toEqual(AMBIENTE_SEM_NOTIFICACOES);
    });

    it('deve ler o contexto seguro e a API da janela', () => {
      const { api } = criarApiFalsa('default');
      const janela = { isSecureContext: true, Notification: api };

      const ambiente = lerAmbienteNotificacoes(
        janela as unknown as Window & typeof globalThis,
      );

      expect(ambiente).toEqual({ contextoSeguro: true, api });
    });

    it('deve indicar API ausente quando a janela não oferece Notification', () => {
      const janela = { isSecureContext: true };

      const ambiente = lerAmbienteNotificacoes(
        janela as unknown as Window & typeof globalThis,
      );

      expect(ambiente.api).toBeUndefined();
    });
  });

  describe('registro de avisos já exibidos', () => {
    it('deve registrar a chave e filtrá-la nas próximas sincronizações', () => {
      const armazenamento = criarArmazenamento();
      registrarChaveExibida(armazenamento, CONTEUDO.chave);

      const restantes = filtrarNaoExibidas(armazenamento, [
        { chave: CONTEUDO.chave },
        { chave: 'outra@chave' },
      ]);

      expect(restantes).toEqual([{ chave: 'outra@chave' }]);
    });

    it('não deve repetir a mesma chave no registro', () => {
      const armazenamento = criarArmazenamento();
      registrarChaveExibida(armazenamento, CONTEUDO.chave);

      registrarChaveExibida(armazenamento, CONTEUDO.chave);

      expect(lerChavesExibidas(armazenamento)).toEqual([CONTEUDO.chave]);
    });

    it('deve manter só as chaves mais recentes até o limite', () => {
      const armazenamento = criarArmazenamento();
      const total = LEMBRETES.MAXIMO_CHAVES_EXIBIDAS_REGISTRADAS + 5;

      for (let indice = 0; indice < total; indice += 1) {
        registrarChaveExibida(armazenamento, `chave-${indice}`);
      }

      const chaves = lerChavesExibidas(armazenamento);
      expect(chaves).toHaveLength(LEMBRETES.MAXIMO_CHAVES_EXIBIDAS_REGISTRADAS);
      expect(chaves.at(-1)).toBe(`chave-${total - 1}`);
      expect(chaves).not.toContain('chave-0');
    });

    it('deve ignorar conteúdo corrompido no armazenamento', () => {
      const armazenamento = criarArmazenamento({
        [CHAVE_ARMAZENAMENTO]: '{não é json',
      });

      expect(lerChavesExibidas(armazenamento)).toEqual([]);
    });

    it('deve descartar valores que não são texto', () => {
      const armazenamento = criarArmazenamento({
        [CHAVE_ARMAZENAMENTO]: JSON.stringify(['ok', 1, null, { a: 1 }]),
      });

      expect(lerChavesExibidas(armazenamento)).toEqual(['ok']);
    });

    it('não deve lançar erro quando o armazenamento recusa a gravação', () => {
      const armazenamento: ArmazenamentoChaves = {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      };

      expect(() =>
        registrarChaveExibida(armazenamento, CONTEUDO.chave),
      ).not.toThrow();
    });

    it('deve funcionar sem armazenamento, sem filtrar nada', () => {
      registrarChaveExibida(null, CONTEUDO.chave);

      const restantes = filtrarNaoExibidas(null, [{ chave: CONTEUDO.chave }]);

      expect(restantes).toEqual([{ chave: CONTEUDO.chave }]);
    });

    it('deve devolver nulo quando o acesso ao localStorage é bloqueado', () => {
      const janela = {};
      Object.defineProperty(janela, 'localStorage', {
        get: () => {
          throw new Error('SecurityError');
        },
      });

      const armazenamento = obterArmazenamentoLocal(
        janela as unknown as Window & typeof globalThis,
      );

      expect(armazenamento).toBeNull();
    });
  });
});
