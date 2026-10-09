import type { ChaveAnimal } from '@/config/animais';
import type { ModalidadeCompartilhamento } from '@/config/constantes';
import type { SituacaoCredencial } from '@/servidor/seguranca/tokens';

// Datas já formatadas no servidor, no fuso do board: o navegador só exibe.
export type LinkExibido = {
  id: number;
  nome: string;
  modalidade: ModalidadeCompartilhamento;
  padrao: boolean;
  incluirArquivadas: boolean;
  animal: ChaveAnimal | null;
  tags: string[];
  solicitantes: string[];
  criadoEm: string;
  expiraEm: string | null;
  ultimoAcessoEm: string | null;
  revogadoEm: string | null;
  situacao: SituacaoCredencial;
};

export type OpcaoEscopo = {
  id: number;
  nome: string;
  quantidadeAtividades: number;
};
