import { CHAVES_ANIMAIS, montarApelidoAnonimo } from '@/config/animais';
import {
  criarEstadoPresenca,
  listarPresentes,
  PRESENCA,
  registrarSinal,
  removerVisitante,
  type EstadoPresenca,
} from '@/servidor/presenca/presencaBoard';

const INICIO = 1_000_000;
const ID_A = 'visitante-aaaaaaaaaaaa';
const ID_B = 'visitante-bbbbbbbbbbbb';
const SEMPRE_PRIMEIRO = () => 0;

describe('presencaBoard', () => {
  let estado: EstadoPresenca;

  beforeEach(() => {
    estado = criarEstadoPresenca();
  });

  function sinal(visitanteId: string, agora = INICIO, tipo = 'link' as const) {
    return registrarSinal(estado, {
      visitanteId,
      tipo,
      agora,
      sortear: SEMPRE_PRIMEIRO,
    });
  }

  it('deve dar um animal ao visitante por link e mantê-lo nos sinais seguintes', () => {
    const primeiro = sinal(ID_A);
    const segundo = sinal(ID_A, INICIO + 1000);

    expect(primeiro.voce.animal).toBe(CHAVES_ANIMAIS[0]);
    expect(segundo.voce).toEqual(primeiro.voce);
    expect(segundo.presentes).toHaveLength(1);
  });

  it('não deve repetir animal enquanto houver algum livre', () => {
    const animais = CHAVES_ANIMAIS.map(
      (_, indice) =>
        sinal(`visitante-${String(indice).padStart(12, '0')}`).voce.animal,
    );

    expect(new Set(animais).size).toBe(CHAVES_ANIMAIS.length);
  });

  it('deve repetir animal só quando todos estiverem em uso', () => {
    CHAVES_ANIMAIS.forEach((_, indice) =>
      sinal(`visitante-${String(indice).padStart(12, '0')}`),
    );

    expect(sinal('visitante-extra-000000').voce.animal).toBe(CHAVES_ANIMAIS[0]);
  });

  it('nunca deve expor o identificador do visitante', () => {
    const { voce, presentes } = sinal(ID_A);

    expect(voce.id).not.toContain(ID_A);
    expect(voce.id).toHaveLength(PRESENCA.TAMANHO_ID_OPACO);
    expect(JSON.stringify(presentes)).not.toContain(ID_A);
  });

  it('deve tirar da lista quem parou de mandar sinal', () => {
    sinal(ID_A);
    sinal(ID_B, INICIO + PRESENCA.VALIDADE_SINAL_MS);

    expect(
      listarPresentes(estado, INICIO + PRESENCA.VALIDADE_SINAL_MS + 1),
    ).toHaveLength(1);
  });

  it('deve tirar na hora quem fechou a aba e devolver o mesmo animal se voltar', () => {
    const { voce } = sinal(ID_A);
    removerVisitante(estado, ID_A);
    const listaDepois = listarPresentes(estado, INICIO + 1);
    sinal(ID_B, INICIO + 2);

    const volta = sinal(ID_A, INICIO + 3);

    expect(listaDepois).toEqual([]);
    expect(volta.voce.animal).toBe(voce.animal);
  });

  it('deve mostrar o proprietário sem animal e uma vez só, mesmo em várias abas', () => {
    registrarSinal(estado, {
      visitanteId: ID_A,
      tipo: 'proprietario',
      agora: INICIO,
    });
    registrarSinal(estado, {
      visitanteId: ID_B,
      tipo: 'proprietario',
      agora: INICIO,
    });
    const { presentes } = sinal('visitante-cccccccccccc');

    expect(presentes.filter((p) => p.tipo === 'proprietario')).toEqual([
      expect.objectContaining({ animal: null }),
    ]);
    expect(presentes).toHaveLength(2);
  });

  it('deve mostrar o nome do link nomeado e manter o animal fixo dele', () => {
    const primeiro = registrarSinal(estado, {
      visitanteId: ID_A,
      tipo: 'link',
      nome: 'Carla',
      animalFixo: 'jacare',
      agora: INICIO,
      sortear: SEMPRE_PRIMEIRO,
    });
    const outroAparelho = registrarSinal(estado, {
      visitanteId: ID_B,
      tipo: 'link',
      nome: 'Carla',
      animalFixo: 'jacare',
      agora: INICIO + 1,
      sortear: SEMPRE_PRIMEIRO,
    });

    expect(primeiro.voce).toEqual(
      expect.objectContaining({ nome: 'Carla', animal: 'jacare' }),
    );
    expect(outroAparelho.voce.animal).toBe('jacare');
  });

  it('deve trocar para o animal fixo quando o link passar a ter um', () => {
    const antes = sinal(ID_A);
    const depois = registrarSinal(estado, {
      visitanteId: ID_A,
      tipo: 'link',
      nome: 'Financeiro',
      animalFixo: 'seriema',
      agora: INICIO + 1000,
    });

    expect(antes.voce).toEqual(
      expect.objectContaining({ nome: null, animal: CHAVES_ANIMAIS[0] }),
    );
    expect(depois.voce).toEqual(
      expect.objectContaining({ nome: 'Financeiro', animal: 'seriema' }),
    );
  });

  it('não deve dar nome ao proprietário', () => {
    const { voce } = registrarSinal(estado, {
      visitanteId: ID_A,
      tipo: 'proprietario',
      nome: 'Ignorado',
      agora: INICIO,
    });

    expect(voce).toEqual(expect.objectContaining({ nome: null, animal: null }));
  });

  it('deve limitar a quantidade de visitantes em memória', () => {
    for (let indice = 0; indice <= PRESENCA.MAXIMO_VISITANTES; indice += 1) {
      sinal(`visitante-${String(indice).padStart(12, '0')}`);
    }

    expect(estado.visitantes.size).toBe(PRESENCA.MAXIMO_VISITANTES);
  });

  it.each([
    ['capivara', 'Capivara anônima'],
    ['tucano', 'Tucano anônimo'],
    ['lobo-guara', 'Lobo-guará anônimo'],
    ['preguica', 'Preguiça anônima'],
    ['mico-leao', 'Mico-leão-dourado anônimo'],
    ['ariranha', 'Ariranha anônima'],
  ] as const)('deve concordar o apelido de %s', (chave, apelido) => {
    expect(montarApelidoAnonimo(chave)).toBe(apelido);
  });
});
