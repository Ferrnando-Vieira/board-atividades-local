import {
  aplicarMovimento,
  decidirInicioArraste,
  aplicarMovimentoCartao,
  calcularIndiceInsercao,
  calcularIndiceOrdenado,
  calcularVelocidadeRolagem,
  ehTeclaMovimento,
  escolherIntervaloMaisProximo,
  intercalarIndicador,
  montarCargaMovimentoCartao,
  montarCargaReordenacao,
  moverCartaoPorTecla,
  moverColunaPorTecla,
  movimentoAlteraPosicao,
} from '@/screens/board/movimentosQuadro';
import type {
  CartaoQuadro,
  ColunaQuadro,
} from '@/servidor/board/consultaQuadro';

const VERSAO_INICIAL = 1;
const PRIORIDADE_PADRAO = 5;
const PRIORIDADE_MAIS_ALTA = 0;
const ID_A_FAZER = 1;
const ID_EM_ANDAMENTO = 2;
const ID_CONCLUIDOS = 3;
const ID_INEXISTENTE = 99;
const ID_SOLICITANTE = 1;

// A data de criação acompanha o id (segundos), então cartões de mesma
// prioridade ficam na ordem dos ids, como no banco.
function montarCriacao(segundos: number): string {
  return new Date(Date.UTC(2026, 8, 1, 0, 0, segundos)).toISOString();
}

function montarCartao(
  id: number,
  prioridade = PRIORIDADE_PADRAO,
  criadoEm = montarCriacao(id),
): CartaoQuadro {
  return {
    id,
    titulo: `Atividade ${id}`,
    prioridade,
    versao: VERSAO_INICIAL,
    criadoEm,
    solicitanteId: ID_SOLICITANTE,
    solicitante: 'Eu',
    tags: [],
    prazoData: null,
    prazoHora: null,
    concluidaEmData: null,
    concluidaEmHora: null,
  };
}

function montarColunas(): ColunaQuadro[] {
  return [
    {
      id: ID_A_FAZER,
      nome: 'A Fazer',
      finalizaAtividade: false,
      corTitulo: null,
      corColuna: null,
      atividades: [montarCartao(10), montarCartao(11), montarCartao(12)],
    },
    {
      id: ID_EM_ANDAMENTO,
      nome: 'Em Andamento',
      finalizaAtividade: false,
      corTitulo: null,
      corColuna: null,
      atividades: [montarCartao(20)],
    },
    {
      id: ID_CONCLUIDOS,
      nome: 'Concluídos',
      finalizaAtividade: true,
      corTitulo: null,
      corColuna: null,
      atividades: [],
    },
  ];
}

function idsDaColuna(colunas: ColunaQuadro[], statusId: number): number[] {
  return (
    colunas
      .find((coluna) => coluna.id === statusId)
      ?.atividades.map((cartao) => cartao.id) ?? []
  );
}

describe('movimentosQuadro', () => {
  describe('aplicarMovimentoCartao', () => {
    it('deve levar o cartão à posição da ordem automática, ignorando onde foi solto', () => {
      const colunas = aplicarMovimentoCartao(montarColunas(), {
        tipo: 'cartao',
        atividadeId: 11,
        statusId: ID_EM_ANDAMENTO,
        indice: 1,
      });

      expect(idsDaColuna(colunas, ID_A_FAZER)).toEqual([10, 12]);
      expect(idsDaColuna(colunas, ID_EM_ANDAMENTO)).toEqual([11, 20]);
    });

    it('deve colocar a atividade mais crítica no topo do destino', () => {
      const [primeira, ...demais] = montarColunas();
      if (!primeira) {
        throw new Error('Coluna de teste ausente.');
      }
      const colunas = [
        {
          ...primeira,
          atividades: [montarCartao(30, PRIORIDADE_MAIS_ALTA)],
        },
        ...demais,
      ];

      const resultado = aplicarMovimentoCartao(colunas, {
        tipo: 'cartao',
        atividadeId: 30,
        statusId: ID_EM_ANDAMENTO,
        indice: 1,
      });

      expect(idsDaColuna(resultado, ID_EM_ANDAMENTO)).toEqual([30, 20]);
    });

    it('deve prever a versão nova quando o status muda', () => {
      const colunas = aplicarMovimentoCartao(montarColunas(), {
        tipo: 'cartao',
        atividadeId: 10,
        statusId: ID_CONCLUIDOS,
        indice: 0,
      });

      expect(colunas[2]?.atividades[0]?.versao).toBe(VERSAO_INICIAL + 1);
    });

    it('não deve reordenar nem mudar a versão ao soltar na mesma coluna', () => {
      const colunas = montarColunas();

      const resultado = aplicarMovimentoCartao(colunas, {
        tipo: 'cartao',
        atividadeId: 10,
        statusId: ID_A_FAZER,
        indice: 2,
      });

      expect(resultado).toEqual(colunas);
    });

    it('deve ignorar movimento para coluna inexistente', () => {
      const colunas = montarColunas();

      const resultado = aplicarMovimentoCartao(colunas, {
        tipo: 'cartao',
        atividadeId: 10,
        statusId: ID_INEXISTENTE,
        indice: 0,
      });

      expect(resultado).toEqual(colunas);
    });
  });

  describe('calcularIndiceOrdenado', () => {
    it('deve devolver o lugar do cartão pela prioridade e pela criação', () => {
      const colunas = montarColunas();

      expect(calcularIndiceOrdenado(colunas, 12, ID_EM_ANDAMENTO)).toBe(0);
      expect(calcularIndiceOrdenado(colunas, 11, ID_A_FAZER)).toBe(1);
    });

    it('deve desempatar pelo identificador quando prioridade e criação coincidem', () => {
      const criacao = montarCriacao(1);
      const colunas: ColunaQuadro[] = [
        {
          id: ID_A_FAZER,
          nome: 'A Fazer',
          finalizaAtividade: false,
          corTitulo: null,
          corColuna: null,
          atividades: [montarCartao(40, PRIORIDADE_PADRAO, criacao)],
        },
        {
          id: ID_EM_ANDAMENTO,
          nome: 'Em Andamento',
          finalizaAtividade: false,
          corTitulo: null,
          corColuna: null,
          atividades: [
            montarCartao(39, PRIORIDADE_PADRAO, criacao),
            montarCartao(41, PRIORIDADE_PADRAO, criacao),
          ],
        },
      ];

      expect(calcularIndiceOrdenado(colunas, 40, ID_EM_ANDAMENTO)).toBe(1);
    });

    it('deve devolver zero para cartão ou coluna desconhecidos', () => {
      expect(
        calcularIndiceOrdenado(montarColunas(), ID_INEXISTENTE, ID_A_FAZER),
      ).toBe(0);
      expect(calcularIndiceOrdenado(montarColunas(), 10, ID_INEXISTENTE)).toBe(
        0,
      );
    });
  });

  describe('montarCargaMovimentoCartao', () => {
    it('deve enviar só o status de destino e a versão vista pelo cliente', () => {
      const carga = montarCargaMovimentoCartao(montarColunas(), {
        tipo: 'cartao',
        atividadeId: 12,
        statusId: ID_EM_ANDAMENTO,
        indice: 1,
      });

      expect(carga).toEqual({
        atividadeId: 12,
        versaoEsperada: VERSAO_INICIAL,
        statusDestinoId: ID_EM_ANDAMENTO,
        posicao: null,
      });
    });

    it('deve partir do estado otimista em arrastes sucessivos', () => {
      const aposPrimeiro = aplicarMovimento(montarColunas(), {
        tipo: 'cartao',
        atividadeId: 10,
        statusId: ID_EM_ANDAMENTO,
        indice: 1,
      });

      const carga = montarCargaMovimentoCartao(aposPrimeiro, {
        tipo: 'cartao',
        atividadeId: 10,
        statusId: ID_CONCLUIDOS,
        indice: 0,
      });

      expect(carga).toEqual({
        atividadeId: 10,
        versaoEsperada: VERSAO_INICIAL + 1,
        statusDestinoId: ID_CONCLUIDOS,
        posicao: null,
      });
    });

    it('não deve gerar carga quando o status não muda', () => {
      expect(
        montarCargaMovimentoCartao(montarColunas(), {
          tipo: 'cartao',
          atividadeId: 10,
          statusId: ID_A_FAZER,
          indice: 2,
        }),
      ).toBeNull();
    });

    it('deve devolver null para cartão desconhecido', () => {
      expect(
        montarCargaMovimentoCartao(montarColunas(), {
          tipo: 'cartao',
          atividadeId: ID_INEXISTENTE,
          statusId: ID_EM_ANDAMENTO,
          indice: 0,
        }),
      ).toBeNull();
    });
  });

  describe('reordenação de colunas', () => {
    it('deve montar a nova ordem completa das colunas', () => {
      const carga = montarCargaReordenacao(montarColunas(), {
        tipo: 'coluna',
        statusId: ID_CONCLUIDOS,
        indice: 0,
      });

      expect(carga).toEqual({
        statusId: ID_CONCLUIDOS,
        ordemNova: [ID_CONCLUIDOS, ID_A_FAZER, ID_EM_ANDAMENTO],
      });
    });

    it('deve aplicar a reordenação ao estado otimista', () => {
      const colunas = aplicarMovimento(montarColunas(), {
        tipo: 'coluna',
        statusId: ID_A_FAZER,
        indice: 2,
      });

      expect(colunas.map((coluna) => coluna.id)).toEqual([
        ID_EM_ANDAMENTO,
        ID_CONCLUIDOS,
        ID_A_FAZER,
      ]);
    });
  });

  describe('movimentoAlteraPosicao', () => {
    it('não deve considerar alteração soltar o cartão na própria coluna', () => {
      const colunas = montarColunas();

      expect(
        movimentoAlteraPosicao(colunas, {
          tipo: 'cartao',
          atividadeId: 11,
          statusId: ID_A_FAZER,
          indice: 1,
        }),
      ).toBe(false);
      expect(
        movimentoAlteraPosicao(colunas, {
          tipo: 'cartao',
          atividadeId: 11,
          statusId: ID_A_FAZER,
          indice: 0,
        }),
      ).toBe(false);
    });

    it('deve reconhecer a troca de coluna', () => {
      expect(
        movimentoAlteraPosicao(montarColunas(), {
          tipo: 'cartao',
          atividadeId: 11,
          statusId: ID_EM_ANDAMENTO,
          indice: 0,
        }),
      ).toBe(true);
    });

    it('deve reconhecer quando a coluna fica no mesmo lugar', () => {
      expect(
        movimentoAlteraPosicao(montarColunas(), {
          tipo: 'coluna',
          statusId: ID_EM_ANDAMENTO,
          indice: 1,
        }),
      ).toBe(false);
    });
  });

  describe('alvo do arraste', () => {
    const INTERVALOS = [
      { id: ID_A_FAZER, inicio: 0, fim: 280 },
      { id: ID_EM_ANDAMENTO, inicio: 300, fim: 580 },
    ];

    it('deve escolher o intervalo que contém a coordenada', () => {
      expect(escolherIntervaloMaisProximo(INTERVALOS, 320)).toBe(
        ID_EM_ANDAMENTO,
      );
    });

    it('deve escolher o intervalo mais próximo no espaço entre colunas', () => {
      expect(escolherIntervaloMaisProximo(INTERVALOS, 286)).toBe(ID_A_FAZER);
      expect(escolherIntervaloMaisProximo(INTERVALOS, 296)).toBe(
        ID_EM_ANDAMENTO,
      );
    });

    it('deve devolver null sem intervalos', () => {
      expect(escolherIntervaloMaisProximo([], 10)).toBeNull();
    });

    it.each([
      [0, 0],
      [55, 1],
      [150, 2],
      [400, 3],
    ])('deve inserir na coordenada %p no índice %p', (coordenada, indice) => {
      expect(calcularIndiceInsercao([50, 100, 200], coordenada)).toBe(indice);
    });
  });

  describe('calcularVelocidadeRolagem', () => {
    it('deve rolar para trás perto do início e para frente perto do fim', () => {
      expect(calcularVelocidadeRolagem(5, 0, 1000)).toBeLessThan(0);
      expect(calcularVelocidadeRolagem(995, 0, 1000)).toBeGreaterThan(0);
    });

    it('não deve rolar longe das bordas', () => {
      expect(calcularVelocidadeRolagem(500, 0, 1000)).toBe(0);
    });
  });

  describe('teclado', () => {
    it('deve reconhecer apenas as teclas de movimento', () => {
      expect(ehTeclaMovimento('ArrowLeft')).toBe(true);
      expect(ehTeclaMovimento('a')).toBe(false);
    });

    it.each(['ArrowUp', 'ArrowDown', 'Home', 'End'] as const)(
      'não deve reposicionar dentro da coluna com %s',
      (tecla) => {
        const posicao = { statusId: ID_A_FAZER, indice: 1 };

        expect(
          moverCartaoPorTecla(montarColunas(), 11, posicao, tecla),
        ).toEqual(posicao);
      },
    );

    it('deve trocar de coluna já na posição automática do destino', () => {
      const posicao = moverCartaoPorTecla(
        montarColunas(),
        12,
        { statusId: ID_A_FAZER, indice: 2 },
        'ArrowRight',
      );

      expect(posicao).toEqual({ statusId: ID_EM_ANDAMENTO, indice: 0 });
    });

    it('não deve sair do quadro pelas pontas', () => {
      const posicao = { statusId: ID_A_FAZER, indice: 0 };

      expect(
        moverCartaoPorTecla(montarColunas(), 10, posicao, 'ArrowLeft'),
      ).toEqual(posicao);
    });

    it('deve mover colunas com setas e pontas', () => {
      expect(moverColunaPorTecla(3, 0, 'ArrowLeft')).toBe(0);
      expect(moverColunaPorTecla(3, 0, 'ArrowRight')).toBe(1);
      expect(moverColunaPorTecla(3, 1, 'End')).toBe(2);
      expect(moverColunaPorTecla(3, 2, 'Home')).toBe(0);
    });
  });

  describe('intercalarIndicador', () => {
    const ITENS = ['A', 'B', 'C'];

    function descrever(indiceIndicador: number | null, arrastado = 'B') {
      return intercalarIndicador(
        ITENS,
        (item) => item === arrastado,
        indiceIndicador,
      ).map((elemento) =>
        elemento.tipo === 'indicador' ? '|' : elemento.item,
      );
    }

    it('não deve inserir indicador sem arraste em curso', () => {
      expect(descrever(null)).toEqual(['A', 'B', 'C']);
    });

    it('deve marcar o destino antes do próprio item quando nada muda', () => {
      expect(descrever(1)).toEqual(['A', '|', 'B', 'C']);
    });

    it('deve contar as posições sem o item arrastado', () => {
      expect(descrever(0)).toEqual(['|', 'A', 'B', 'C']);
      expect(descrever(2)).toEqual(['A', 'B', 'C', '|']);
    });

    it('deve marcar o fim de uma coluna que não contém o item arrastado', () => {
      expect(descrever(3, 'Z')).toEqual(['A', 'B', 'C', '|']);
    });
  });
});

describe('decidirInicioArraste', () => {
  it.each([
    ['mouse', 0, 0, 'aguardar'],
    ['mouse', 4.9, 10, 'aguardar'],
    ['mouse', 5, 0, 'iniciar'],
    ['pen', 12, 0, 'iniciar'],
    ['touch', 3, 100, 'aguardar'],
    ['touch', 3, 250, 'iniciar'],
    ['touch', 8, 400, 'iniciar'],
    ['touch', 9, 50, 'desistir'],
    ['touch', 30, 400, 'desistir'],
  ] as const)(
    'com %s, distância %d e %d ms deve %s',
    (tipoPonteiro, distancia, decorridoMs, decisao) => {
      expect(
        decidirInicioArraste({ tipoPonteiro, distancia, decorridoMs }),
      ).toBe(decisao);
    },
  );
});
