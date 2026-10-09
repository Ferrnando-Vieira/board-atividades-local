import {
  compararTextos,
  extrairIniciais,
  gerarChaveNormalizada,
  normalizarNomeExibicao,
  removerNomesRepetidos,
} from '@/util/NormalizacaoUtils';

const NOME_COM_ACENTO_DECOMPOSTO = 'Revisa\u0303o te\u0301cnica';
const NOME_COM_ACENTO_COMPOSTO = 'Revisão técnica';

describe('NormalizacaoUtils', () => {
  describe('normalizarNomeExibicao', () => {
    it('deve remover espaços das pontas e colapsar espaços internos', () => {
      const nome = normalizarNomeExibicao('  Code \t  Review \n');

      expect(nome).toBe('Code Review');
    });

    it('deve unificar acentos compostos e decompostos em NFC', () => {
      const nome = normalizarNomeExibicao(NOME_COM_ACENTO_DECOMPOSTO);

      expect(nome).toBe(NOME_COM_ACENTO_COMPOSTO);
    });

    it('deve preservar caixa e acentos do nome exibido', () => {
      const nome = normalizarNomeExibicao('Reforma tributária');

      expect(nome).toBe('Reforma tributária');
    });

    it('deve retornar texto vazio para entrada só com espaços', () => {
      const nome = normalizarNomeExibicao('   ');

      expect(nome).toBe('');
    });
  });

  describe('gerarChaveNormalizada', () => {
    it.each([
      ['Eu', 'eu'],
      [' eu ', 'eu'],
      ['EU', 'eu'],
      ['Revisao  tecnica', 'revisao tecnica'],
      [NOME_COM_ACENTO_COMPOSTO, 'revisao tecnica'],
      [NOME_COM_ACENTO_DECOMPOSTO, 'revisao tecnica'],
      ['Faturas · Bugs', 'faturas · bugs'],
    ])('deve gerar a chave "%s" -> "%s"', (entrada, esperada) => {
      const chave = gerarChaveNormalizada(entrada);

      expect(chave).toBe(esperada);
    });

    it('deve gerar chaves diferentes para nomes realmente diferentes', () => {
      const chavePortal = gerarChaveNormalizada('Portal');
      const chaveInfra = gerarChaveNormalizada('Infra');

      expect(chavePortal).not.toBe(chaveInfra);
    });
  });

  describe('removerNomesRepetidos', () => {
    it('deve manter a grafia da primeira ocorrência e descartar variações', () => {
      const nomes = removerNomesRepetidos([
        'Faturas',
        ' faturas ',
        'FATURAS',
        'Bugs',
      ]);

      expect(nomes).toEqual(['Faturas', 'Bugs']);
    });

    it('deve descartar nomes que ficam vazios depois de normalizados', () => {
      const nomes = removerNomesRepetidos(['  ', '', 'Infra']);

      expect(nomes).toEqual(['Infra']);
    });

    it('deve retornar lista vazia para entrada vazia', () => {
      expect(removerNomesRepetidos([])).toEqual([]);
    });
  });

  describe('compararTextos', () => {
    it('deve ordenar ignorando caixa e acentos, como em pt-BR', () => {
      const ordenados = ['bugs', 'Ágil', 'Faturas', 'agenda'].sort(
        compararTextos,
      );

      expect(ordenados).toEqual(['agenda', 'Ágil', 'bugs', 'Faturas']);
    });

    it('deve comparar números contidos no texto pelo valor', () => {
      const ordenados = ['Sprint 10', 'Sprint 2'].sort(compararTextos);

      expect(ordenados).toEqual(['Sprint 2', 'Sprint 10']);
    });
  });

  describe('extrairIniciais', () => {
    it.each([
      ['maria.souza', 'MS'],
      ['Eu', 'E'],
      ['ana maria souza', 'AM'],
      ['  joão_silva ', 'JS'],
      ['', ''],
    ])('deve extrair as iniciais de %p', (nome, iniciais) => {
      expect(extrairIniciais(nome)).toBe(iniciais);
    });
  });
});
