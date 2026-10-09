import { z } from 'zod';
import {
  esquemaAnimalLink,
  esquemaEdicaoLink,
  esquemaNovoLink,
  VALOR_MANTER_VALIDADE,
} from '@/servidor/compartilhamento/esquemasCompartilhamento';
import { mensagensCompartilhamento } from '@/servidor/compartilhamento/mensagensCompartilhamento';

const BASE_RESTRITO = {
  nome: 'Financeiro',
  modalidade: 'restrito',
  tagIds: ['3'],
  solicitanteIds: [],
  incluirArquivadas: '',
  validadeDias: '',
};

describe('esquemaNovoLink', () => {
  it('deve exigir ao menos uma tag ou um solicitante no link restrito', () => {
    const resultado = esquemaNovoLink.safeParse({
      ...BASE_RESTRITO,
      tagIds: [],
    });

    expect(resultado.success).toBe(false);
    expect(
      resultado.error && z.flattenError(resultado.error).formErrors,
    ).toEqual([mensagensCompartilhamento.escopoObrigatorio]);
  });

  it('deve aceitar só solicitante, já que grupo vazio não filtra', () => {
    const resultado = esquemaNovoLink.parse({
      ...BASE_RESTRITO,
      tagIds: [],
      solicitanteIds: ['5'],
    });

    expect(resultado.solicitanteIds).toEqual([5]);
  });

  it('deve descartar o escopo e incluir arquivadas no link completo', () => {
    const resultado = esquemaNovoLink.parse({
      ...BASE_RESTRITO,
      modalidade: 'completo',
      solicitanteIds: ['5'],
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        modalidade: 'completo',
        tagIds: [],
        solicitanteIds: [],
        incluirArquivadas: true,
      }),
    );
  });

  it('deve normalizar o nome e remover identificadores repetidos', () => {
    const resultado = esquemaNovoLink.parse({
      ...BASE_RESTRITO,
      nome: '  Time   financeiro ',
      tagIds: ['3', '03', '4'],
      incluirArquivadas: 'sim',
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        nome: 'Time financeiro',
        tagIds: [3, 4],
        incluirArquivadas: true,
        validadeDias: null,
      }),
    );
  });

  it.each([
    ['modalidade desconhecida', { modalidade: 'admin' }],
    ['validade fora da lista', { validadeDias: '2' }],
    ['identificador inválido', { tagIds: ['abc'] }],
    ['nome vazio', { nome: '   ' }],
    ['animal fora do catálogo', { animal: 'dragao' }],
  ])('deve recusar %s', (_descricao, alteracao) => {
    expect(
      esquemaNovoLink.safeParse({ ...BASE_RESTRITO, ...alteracao }).success,
    ).toBe(false);
  });
});

describe('animal do link', () => {
  it('deve tratar o animal em branco como sorteado', () => {
    expect(esquemaNovoLink.parse({ ...BASE_RESTRITO, animal: '' }).animal).toBe(
      null,
    );
  });

  it('deve aceitar um animal do catálogo', () => {
    expect(esquemaAnimalLink.parse({ linkId: '4', animal: 'tatu' })).toEqual({
      linkId: 4,
      animal: 'tatu',
    });
  });

  it('deve recusar animal desconhecido', () => {
    expect(
      esquemaAnimalLink.safeParse({ linkId: '4', animal: 'unicornio' }).success,
    ).toBe(false);
  });
});

describe('esquemaEdicaoLink', () => {
  it('deve manter a validade com "manter" e removê-la com vazio', () => {
    const manter = esquemaEdicaoLink.parse({
      ...BASE_RESTRITO,
      linkId: '4',
      validadeDias: VALOR_MANTER_VALIDADE,
    });
    const remover = esquemaEdicaoLink.parse({
      ...BASE_RESTRITO,
      linkId: '4',
    });

    expect(manter).toEqual(
      expect.objectContaining({ linkId: 4, validadeDias: undefined }),
    );
    expect(remover.validadeDias).toBeNull();
  });

  it('deve aplicar as mesmas regras de escopo da criação', () => {
    const semEscopo = esquemaEdicaoLink.safeParse({
      ...BASE_RESTRITO,
      linkId: '4',
      tagIds: [],
      validadeDias: VALOR_MANTER_VALIDADE,
    });
    const completo = esquemaEdicaoLink.parse({
      ...BASE_RESTRITO,
      linkId: '4',
      modalidade: 'completo',
      validadeDias: VALOR_MANTER_VALIDADE,
    });

    expect(semEscopo.success).toBe(false);
    expect(completo).toEqual(
      expect.objectContaining({ tagIds: [], incluirArquivadas: true }),
    );
  });
});
