import type { ChaveAnimal } from '@/config/animais';
import type { ModalidadeCompartilhamento } from '@/config/constantes';
import type { SituacaoValidade } from '@/servidor/seguranca/tokens';

// Datas já formatadas no servidor, no fuso do board: o navegador só exibe.
export type LinkExibido = {
  id: number;
  nome: string;
  modalidade: ModalidadeCompartilhamento;
  padrao: boolean;
  incluirArquivadas: boolean;
  animal: ChaveAnimal | null;
  tags: OpcaoEscopoLink[];
  solicitantes: OpcaoEscopoLink[];
  criadoEm: string;
  expiraEm: string | null;
  ultimoAcessoEm: string | null;
  situacao: SituacaoValidade;
  // Nulo quando o endereço não pode ser reconstruído (link anterior à
  // derivação ou chave trocada).
  url: string | null;
};

export type OpcaoEscopoLink = {
  id: number;
  nome: string;
};

export type OpcaoEscopo = {
  id: number;
  nome: string;
  quantidadeAtividades: number;
};
