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

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { FUSO_HORARIO_PADRAO } from '@/config/constantes';
import { criarSessao } from '@/servidor/administracao/sessoes';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { atividades, ID_REGISTRO_UNICO } from '@/servidor/banco/esquema';
import { montarPrefixoCompartilhamento } from '@/config/rotas';
import { escopoDoLink } from '@/servidor/board/escopoAparencia';
import {
  consultarConfiguracaoFundo,
  consultarFundoBoard,
  mensagensFundo,
  possuiAparenciaPropria,
} from '@/servidor/board/fundoBoard';
import { garantirLinkPadrao } from '@/servidor/compartilhamento/linkPadrao';
import { mensagensLembretes } from '@/servidor/lembretes/mensagensLembretes';
import { consultarAparenciaBoard } from '@/servidor/board/aparenciaBoard';
import { buscarSolicitantePadrao } from '@/servidor/classificacao/classificacaoRepositorio';
import { mensagensSolicitantes } from '@/servidor/classificacao/mensagensSolicitantes';
import { listarLembretesAvulsos } from '@/servidor/lembretes/lembretesAvulsosServico';
import {
  restaurarAparenciaBoardFormulario,
  salvarCoresPrioridadeFormulario,
  salvarFundoFormulario,
  salvarGradienteFormulario,
  salvarSuperficiesFormulario,
} from '@/servidor/web/acoes/acoesFundo';
import {
  ativarLembreteFormulario,
  cancelarLembreteAvulsoFormulario,
  criarLembreteAvulsoFormulario,
  desativarLembreteFormulario,
  dispensarLembreteAvulsoNotificacao,
  dispensarLembreteNotificacao,
  editarLembreteAvulsoFormulario,
  excluirLembreteAvulsoFormulario,
  excluirLembreteFormulario,
  salvarLembreteFormulario,
  sincronizarLembretesNavegador,
} from '@/servidor/web/acoes/acoesLembretes';
import { salvarSolicitantePadraoFormulario } from '@/servidor/web/acoes/acoesSolicitantes';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  ESTADO_FORMULARIO_GESTAO_INICIAL,
  type EstadoFormularioGestao,
} from '@/types/formulario';
import { obterMomentoLocal, somarDias, somarHoras } from '@/util/DataUtils';
import {
  CAMPO_CREDENCIAL,
  montarFormularioTeste,
  REDIRECIONA_PARA_ENTRADA,
  simularCookieSessao,
} from '@/tests/suporte/acoesServidor';
import {
  criarBancoInicializado,
  SOLICITANTE_PADRAO_TESTE,
} from '@/tests/suporte/bancoTeste';
import {
  buscarAtividadeGravada,
  exigirBoardId,
} from '@/tests/suporte/fabricasAtividades';
import {
  cadastrarAdministrador,
  criarCenarioEscopo,
  criarLinkDeTeste,
  exigirIdTag,
  type CenarioEscopo,
} from '@/tests/suporte/fabricasCompartilhamento';

const DIAS_ATE_LEMBRETE = 2;
const HORAS_DESDE_LEMBRETE_VENCIDO = 3;
const FUNDOS_MALICIOSOS = [
  'url(https://exemplo.invalid/rastreio.png)',
  'red; background: url(//exemplo.invalid/x)',
  '<script>alert(1)</script>',
  'linear-gradient(red, blue)',
  'PADRAO',
  'padrao ',
  '',
];

type AcaoFormulario = (
  estado: EstadoFormularioGestao,
  dados: FormData,
) => Promise<EstadoFormularioGestao>;

function montarLembreteFuturo() {
  return obterMomentoLocal(
    somarDias(new Date(), DIAS_ATE_LEMBRETE),
    FUSO_HORARIO_PADRAO,
  );
}

describe('ações exclusivas do proprietário', () => {
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
  });

  function entrarComoProprietario(): void {
    simularCookieSessao(
      criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
    );
  }

  function executar(acao: AcaoFormulario, campos: Record<string, string>) {
    return acao(
      ESTADO_FORMULARIO_GESTAO_INICIAL,
      montarFormularioTeste(campos),
    );
  }

  function camposLembrete(atividadeId: number, versao = 1) {
    const momento = montarLembreteFuturo();
    return {
      atividadeId: String(atividadeId),
      versaoEsperada: String(versao),
      lembreteData: momento.data,
      lembreteHora: momento.hora,
    };
  }

  function gravarLembreteVencido(atividadeId: number): string {
    const lembreteEm = somarHoras(
      new Date(),
      -HORAS_DESDE_LEMBRETE_VENCIDO,
    ).toISOString();
    banco
      .update(atividades)
      .set({ lembreteEm, lembreteSituacao: 'pendente' })
      .where(eq(atividades.id, atividadeId))
      .run();
    return lembreteEm;
  }

  function credenciaisDeLink(): [string, string][] {
    return [
      ['completo', criarLinkDeTeste(banco, { modalidade: 'completo' }).token],
      [
        'restrito',
        criarLinkDeTeste(banco, {
          modalidade: 'restrito',
          tagIds: [exigirIdTag(banco, 'Faturas')],
        }).token,
      ],
    ];
  }

  describe('fundo do board', () => {
    it('deve salvar um fundo do catálogo e revalidar o painel', async () => {
      entrarComoProprietario();

      const estado = await executar(salvarFundoFormulario, {
        fundo: 'gradiente-aurora',
      });

      expect(estado.mensagemSucesso).toBe(mensagensFundo.fundoSalvo);
      expect(consultarFundoBoard(banco)).toBe('gradiente-aurora');
      expect(revalidatePath).toHaveBeenCalled();
    });

    it.each(FUNDOS_MALICIOSOS)(
      'deve recusar o valor "%s" sem alterar o fundo',
      async (fundo) => {
        entrarComoProprietario();

        const estado = await executar(salvarFundoFormulario, { fundo });

        expect(estado.mensagemErro).toBe(mensagensFundo.fundoInvalido);
        expect(consultarFundoBoard(banco)).toBe('padrao');
      },
    );

    it('deve exigir a sessão sem credencial de link', async () => {
      await expect(
        executar(salvarFundoFormulario, { fundo: 'cor-menta' }),
      ).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);
      expect(consultarFundoBoard(banco)).toBe('padrao');
    });

    it('com credencial de link nomeado, deve gravar só a aparência daquele link', async () => {
      for (const modalidade of ['completo', 'restrito'] as const) {
        const link = criarLinkDeTeste(banco, {
          modalidade,
          tagIds: [exigirIdTag(banco, 'Faturas')],
        });

        const estado = await executar(salvarFundoFormulario, {
          fundo: 'cor-menta',
          [CAMPO_CREDENCIAL]: link.token,
        });

        expect(estado.mensagemSucesso).toBe(mensagensFundo.fundoSalvo);
        expect(
          consultarConfiguracaoFundo(banco, escopoDoLink(link.linkId))
            .chavePredefinida,
        ).toBe('cor-menta');
      }
      expect(consultarFundoBoard(banco)).toBe('padrao');
    });

    it('deve recusar a credencial do link padrão, que é público', async () => {
      const { token } = garantirLinkPadrao(banco, Buffer.alloc(32, 7));

      await expect(
        executar(salvarFundoFormulario, {
          fundo: 'cor-menta',
          [CAMPO_CREDENCIAL]: token,
        }),
      ).rejects.toThrow(
        `NEXT_REDIRECT:${montarPrefixoCompartilhamento(token)}`,
      );
      expect(consultarFundoBoard(banco)).toBe('padrao');
    });
  });

  describe('lembretes', () => {
    it('deve criar o lembrete com a sessão do proprietário', async () => {
      entrarComoProprietario();

      const estado = await executar(
        salvarLembreteFormulario,
        camposLembrete(cenario.outrosEu),
      );

      expect(estado.mensagemSucesso).toBe(mensagensLembretes.lembreteSalvo);
      expect(buscarAtividadeGravada(banco, cenario.outrosEu)).toEqual(
        expect.objectContaining({ lembreteSituacao: 'pendente', versao: 2 }),
      );
    });

    it('deve recusar data no passado com mensagem clara', async () => {
      entrarComoProprietario();

      const estado = await executar(salvarLembreteFormulario, {
        ...camposLembrete(cenario.outrosEu),
        lembreteData: '2020-01-01',
        lembreteHora: '08:00',
      });

      expect(estado.mensagemErro).toBe(mensagensLembretes.lembreteNoPassado);
      expect(
        buscarAtividadeGravada(banco, cenario.outrosEu).lembreteEm,
      ).toBeNull();
    });

    it('deve apontar o campo de data inválida', async () => {
      entrarComoProprietario();

      const estado = await executar(salvarLembreteFormulario, {
        ...camposLembrete(cenario.outrosEu),
        lembreteData: '2026-02-30',
      });

      expect(estado.errosCampos?.lembreteData).toEqual([
        mensagensLembretes.dataObrigatoria,
      ]);
    });

    it('deve desativar, reativar e excluir o lembrete', async () => {
      entrarComoProprietario();
      await executar(
        salvarLembreteFormulario,
        camposLembrete(cenario.outrosEu),
      );
      const alteracao = (versao: number) => ({
        atividadeId: String(cenario.outrosEu),
        versaoEsperada: String(versao),
      });

      const desativado = await executar(
        desativarLembreteFormulario,
        alteracao(2),
      );
      const reativado = await executar(ativarLembreteFormulario, alteracao(3));
      const excluido = await executar(excluirLembreteFormulario, alteracao(4));

      expect(desativado.mensagemSucesso).toBe(
        mensagensLembretes.lembreteDesativado,
      );
      expect(reativado.mensagemSucesso).toBe(
        mensagensLembretes.lembreteAtivado,
      );
      expect(excluido.mensagemSucesso).toBe(
        mensagensLembretes.lembreteExcluido,
      );
      expect(
        buscarAtividadeGravada(banco, cenario.outrosEu).lembreteEm,
      ).toBeNull();
    });

    it('deve negar aos links completo e restrito qualquer mutação de lembrete', async () => {
      const acoes: [string, AcaoFormulario, Record<string, string>][] = [
        [
          'salvar',
          salvarLembreteFormulario,
          camposLembrete(cenario.faturasFinanceiro),
        ],
        [
          'desativar',
          desativarLembreteFormulario,
          camposLembrete(cenario.faturasFinanceiro),
        ],
        [
          'ativar',
          ativarLembreteFormulario,
          camposLembrete(cenario.faturasFinanceiro),
        ],
        [
          'excluir',
          excluirLembreteFormulario,
          camposLembrete(cenario.faturasFinanceiro),
        ],
      ];
      const antes = buscarAtividadeGravada(banco, cenario.faturasFinanceiro);

      for (const [, token] of credenciaisDeLink()) {
        for (const [, acao, campos] of acoes) {
          await expect(
            executar(acao, { ...campos, [CAMPO_CREDENCIAL]: token }),
          ).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);
        }
      }

      expect(buscarAtividadeGravada(banco, cenario.faturasFinanceiro)).toEqual(
        antes,
      );
    });

    it('não deve disparar nem listar lembretes sem a sessão do proprietário', async () => {
      gravarLembreteVencido(cenario.faturasFinanceiro);

      await expect(sincronizarLembretesNavegador()).rejects.toThrow(
        REDIRECIONA_PARA_ENTRADA,
      );
      expect(
        buscarAtividadeGravada(banco, cenario.faturasFinanceiro)
          .lembreteSituacao,
      ).toBe('pendente');
    });

    it('deve sincronizar entregando o aviso novo uma única vez', async () => {
      entrarComoProprietario();
      const lembreteEm = gravarLembreteVencido(cenario.faturasFinanceiro);

      const primeira = await sincronizarLembretesNavegador();
      const segunda = await sincronizarLembretesNavegador();

      expect(primeira.novas).toEqual([
        expect.objectContaining({
          chave: `${cenario.faturasFinanceiro}@${lembreteEm}`,
          atividadeId: cenario.faturasFinanceiro,
          lembreteEm,
          atrasado: true,
          rotaAtividade: `/atividades/${cenario.faturasFinanceiro}`,
        }),
      ]);
      expect(segunda.novas).toEqual([]);
      expect(segunda.aDispensar).toHaveLength(1);
    });

    it('deve dispensar o aviso com a sessão e recusar entrada inválida', async () => {
      entrarComoProprietario();
      const lembreteEm = gravarLembreteVencido(cenario.faturasFinanceiro);
      await sincronizarLembretesNavegador();

      const invalida = await dispensarLembreteNotificacao({
        atividadeId: cenario.faturasFinanceiro,
        lembreteEm: 'ontem',
      });
      const valida = await dispensarLembreteNotificacao({
        atividadeId: cenario.faturasFinanceiro,
        lembreteEm,
      });
      const depois = await sincronizarLembretesNavegador();

      expect(invalida).toEqual(
        expect.objectContaining({ ok: false, codigo: 'dados-invalidos' }),
      );
      expect(valida).toEqual({ ok: true });
      expect(depois.aDispensar).toEqual([]);
    });

    it('não deve dispensar aviso sem a sessão do proprietário', async () => {
      entrarComoProprietario();
      const lembreteEm = gravarLembreteVencido(cenario.faturasFinanceiro);
      await sincronizarLembretesNavegador();
      simularCookieSessao(undefined);

      await expect(
        dispensarLembreteNotificacao({
          atividadeId: cenario.faturasFinanceiro,
          lembreteEm,
        }),
      ).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);
      expect(
        buscarAtividadeGravada(banco, cenario.faturasFinanceiro)
          .lembreteDispensadoEm,
      ).toBeNull();
    });
  });

  describe('aparência das superfícies, prioridades e gradiente', () => {
    const CAMPOS_SUPERFICIES = {
      corTitulos: '#111111',
      corColunas: '#222222',
      opacidadeTitulos: '80',
      opacidadeColunas: '50',
      tomTexto: 'automatico',
    };
    const CAMPOS_PRIORIDADES = {
      corPrioridadeCritica: '#7048e8',
      corPrioridadeAlta: '#facc15',
      corPrioridadeMedia: '#ffffff',
      corPrioridadeBaixa: '#000000',
    };
    const CAMPOS_GRADIENTE = {
      formato: 'radial',
      angulo: '90',
      corInicial: '#ff1af7',
      corFinal: '#7e67e4',
    };

    it('deve salvar superfícies e prioridades com a sessão do proprietário', async () => {
      entrarComoProprietario();

      const superficies = await executar(
        salvarSuperficiesFormulario,
        CAMPOS_SUPERFICIES,
      );
      const prioridades = await executar(
        salvarCoresPrioridadeFormulario,
        CAMPOS_PRIORIDADES,
      );

      expect(superficies.mensagemSucesso).toBeDefined();
      expect(prioridades.mensagemSucesso).toBeDefined();
      expect(consultarAparenciaBoard(banco)).toEqual(
        expect.objectContaining({
          superficies: expect.objectContaining({
            corColunas: '#222222',
            opacidadeColunas: 50,
          }),
          prioridades: expect.objectContaining({ critica: '#7048e8' }),
        }),
      );
    });

    it('deve recusar valores fora do formato sem gravar', async () => {
      entrarComoProprietario();

      const resultado = await executar(salvarSuperficiesFormulario, {
        ...CAMPOS_SUPERFICIES,
        corColunas: 'url(x)',
        opacidadeTitulos: '150',
      });

      expect(resultado.errosCampos).toEqual(
        expect.objectContaining({
          corColunas: expect.any(Array),
          opacidadeTitulos: expect.any(Array),
        }),
      );
      expect(consultarAparenciaBoard(banco).superficies.corColunas).toBe(
        '#f4f6f3',
      );
    });

    it('com credencial de link nomeado, deve aplicar só ao link e restaurar a do board', async () => {
      const acoes: [AcaoFormulario, Record<string, string>][] = [
        [salvarSuperficiesFormulario, CAMPOS_SUPERFICIES],
        [salvarCoresPrioridadeFormulario, CAMPOS_PRIORIDADES],
        [salvarGradienteFormulario, CAMPOS_GRADIENTE],
      ];
      const link = criarLinkDeTeste(banco, {
        modalidade: 'restrito',
        tagIds: [exigirIdTag(banco, 'Faturas')],
      });
      const escopo = escopoDoLink(link.linkId);

      for (const [acao, campos] of acoes) {
        const estado = await executar(acao, {
          ...campos,
          [CAMPO_CREDENCIAL]: link.token,
        });
        expect(estado.mensagemSucesso).toBeDefined();
      }

      expect(
        consultarAparenciaBoard(banco, escopo).superficies.corColunas,
      ).toBe('#222222');
      expect(consultarAparenciaBoard(banco, escopo).prioridades.alta).toBe(
        '#facc15',
      );
      expect(consultarConfiguracaoFundo(banco, escopo).tipo).toBe('gradiente');
      expect(consultarAparenciaBoard(banco).superficies.corColunas).toBe(
        '#f4f6f3',
      );
      expect(consultarConfiguracaoFundo(banco).tipo).toBe('predefinido');

      const restaurado = await executar(restaurarAparenciaBoardFormulario, {
        [CAMPO_CREDENCIAL]: link.token,
      });

      expect(restaurado.mensagemSucesso).toBe(
        mensagensFundo.aparenciaRestaurada,
      );
      expect(possuiAparenciaPropria(banco, link.linkId)).toBe(false);
      expect(
        consultarAparenciaBoard(banco, escopo).superficies.corColunas,
      ).toBe('#f4f6f3');
    });

    it('não deve restaurar nada a partir do painel do proprietário', async () => {
      entrarComoProprietario();

      const estado = await executar(restaurarAparenciaBoardFormulario, {});

      expect(estado.mensagemErro).toBe(mensagensFundo.restaurarSoNoLink);
    });
  });

  describe('lembretes avulsos', () => {
    function camposNovoAvulso() {
      const momento = montarLembreteFuturo();
      return {
        titulo: 'Ligar para o fornecedor',
        observacao: '',
        lembreteData: momento.data,
        lembreteHora: momento.hora,
      };
    }

    it('deve criar, editar, desativar e excluir com a sessão do proprietário', async () => {
      entrarComoProprietario();

      const criado = await executar(
        criarLembreteAvulsoFormulario,
        camposNovoAvulso(),
      );
      const [lembrete] = listarLembretesAvulsos(banco);
      const identificacao = {
        lembreteId: String(lembrete?.id),
        versaoEsperada: '1',
      };
      const editado = await executar(editarLembreteAvulsoFormulario, {
        ...identificacao,
        ...camposNovoAvulso(),
        titulo: 'Ligar de novo',
      });
      const cancelado = await executar(cancelarLembreteAvulsoFormulario, {
        ...identificacao,
        versaoEsperada: '2',
      });
      const situacaoAntesDeExcluir = listarLembretesAvulsos(banco)[0]?.situacao;
      const excluido = await executar(excluirLembreteAvulsoFormulario, {
        ...identificacao,
        versaoEsperada: '3',
      });

      expect(criado.mensagemSucesso).toBe(
        mensagensLembretes.lembreteAvulsoCriado,
      );
      expect(editado.mensagemSucesso).toBe(
        mensagensLembretes.lembreteAvulsoSalvo,
      );
      expect(cancelado.mensagemSucesso).toBeDefined();
      expect(situacaoAntesDeExcluir).toBe('cancelado');
      expect(excluido.mensagemSucesso).toBe(
        mensagensLembretes.lembreteExcluido,
      );
      expect(listarLembretesAvulsos(banco)).toEqual([]);
    });

    it('não deve criar lembrete avulso com credencial de link', async () => {
      for (const [, token] of credenciaisDeLink()) {
        await expect(
          executar(criarLembreteAvulsoFormulario, {
            ...camposNovoAvulso(),
            [CAMPO_CREDENCIAL]: token,
          }),
        ).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);
      }

      expect(listarLembretesAvulsos(banco)).toEqual([]);
    });

    it('deve sincronizar avisos avulsos com chave própria e listar os próximos', async () => {
      entrarComoProprietario();
      await executar(criarLembreteAvulsoFormulario, camposNovoAvulso());
      const vencidoEm = somarHoras(
        new Date(),
        -HORAS_DESDE_LEMBRETE_VENCIDO,
      ).toISOString();
      banco.$client
        .prepare(
          "INSERT INTO lembretes_avulsos (board_id, titulo, lembrete_em) VALUES (1, 'Vencido', ?)",
        )
        .run(vencidoEm);

      const sincronizacao = await sincronizarLembretesNavegador();
      const [aviso] = sincronizacao.novas;
      const dispensa = await dispensarLembreteAvulsoNotificacao({
        lembreteId: aviso?.lembreteAvulsoId,
        lembreteEm: vencidoEm,
      });
      const depois = await sincronizarLembretesNavegador();

      expect(aviso).toEqual(
        expect.objectContaining({
          origem: 'avulso',
          atividadeId: null,
          titulo: 'Vencido',
          rotaAtividade: null,
          chave: `avulso-${aviso?.lembreteAvulsoId}@${vencidoEm}`,
        }),
      );
      expect(sincronizacao.proximos).toEqual([
        expect.objectContaining({
          origem: 'avulso',
          titulo: 'Ligar para o fornecedor',
        }),
      ]);
      expect(dispensa).toEqual({ ok: true });
      expect(depois.aDispensar).toEqual([]);
    });
  });

  describe('solicitante padrão', () => {
    function padraoAtual() {
      return buscarSolicitantePadrao(banco, exigirBoardId(banco))?.nome;
    }

    it('deve trocar o padrão, cadastrando o nome novo', async () => {
      entrarComoProprietario();

      const estado = await executar(salvarSolicitantePadraoFormulario, {
        nome: '  Equipe   de suporte ',
      });

      expect(estado.mensagemSucesso).toBe(mensagensSolicitantes.padraoSalvo);
      expect(padraoAtual()).toBe('Equipe de suporte');
      expect(revalidatePath).toHaveBeenCalled();
    });

    it('deve recusar nome em branco sem alterar o padrão', async () => {
      entrarComoProprietario();

      const estado = await executar(salvarSolicitantePadraoFormulario, {
        nome: '   ',
      });

      expect(estado.errosCampos?.nome).toEqual([
        mensagensSolicitantes.nomeObrigatorio,
      ]);
      expect(padraoAtual()).toBe(SOLICITANTE_PADRAO_TESTE);
    });

    it('deve exigir a sessão mesmo com credencial de link completo ou restrito', async () => {
      for (const [, token] of credenciaisDeLink()) {
        await expect(
          executar(salvarSolicitantePadraoFormulario, {
            nome: 'Intruso',
            [CAMPO_CREDENCIAL]: token,
          }),
        ).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);
      }
      expect(padraoAtual()).toBe(SOLICITANTE_PADRAO_TESTE);
    });
  });
});
