import {
  assinarAlteracoes,
  criarCanalAlteracoes,
  publicarAlteracao,
  TEMPO_REAL,
  type CanalAlteracoes,
} from '@/servidor/tempoReal/alteracoesBoard';

describe('alteracoesBoard', () => {
  let canal: CanalAlteracoes;

  beforeEach(() => {
    canal = criarCanalAlteracoes();
  });

  it('entrega a nova revisão a todos os ouvintes', () => {
    const primeiro = jest.fn();
    const segundo = jest.fn();
    assinarAlteracoes(canal, primeiro);
    assinarAlteracoes(canal, segundo);

    publicarAlteracao(canal);
    publicarAlteracao(canal);

    expect(primeiro).toHaveBeenNthCalledWith(1, 1);
    expect(primeiro).toHaveBeenNthCalledWith(2, 2);
    expect(segundo).toHaveBeenCalledTimes(2);
  });

  it('para de avisar quem cancelou a assinatura', () => {
    const ouvinte = jest.fn();
    const cancelar = assinarAlteracoes(canal, ouvinte);

    cancelar?.();
    publicarAlteracao(canal);

    expect(ouvinte).not.toHaveBeenCalled();
    expect(canal.ouvintes.size).toBe(0);
  });

  it('descarta o ouvinte que falha sem impedir os demais', () => {
    const quebrado = jest.fn(() => {
      throw new Error('conexão fechada');
    });
    const saudavel = jest.fn();
    assinarAlteracoes(canal, quebrado);
    assinarAlteracoes(canal, saudavel);

    publicarAlteracao(canal);
    publicarAlteracao(canal);

    expect(quebrado).toHaveBeenCalledTimes(1);
    expect(saudavel).toHaveBeenCalledTimes(2);
  });

  it('recusa assinaturas acima do teto', () => {
    for (let indice = 0; indice < TEMPO_REAL.MAXIMO_OUVINTES; indice += 1) {
      assinarAlteracoes(canal, () => undefined);
    }

    expect(assinarAlteracoes(canal, () => undefined)).toBeNull();
  });
});
