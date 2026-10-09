import type { PermissaoApi } from '@/config/constantes';
import type { SituacaoCredencial } from '@/servidor/seguranca/tokens';

// Datas já formatadas no servidor; o hash nunca chega à tela.
export type TokenApiExibido = {
  id: number;
  nome: string;
  prefixo: string;
  permissoes: PermissaoApi[];
  criadoEm: string;
  expiraEm: string | null;
  ultimoUsoEm: string | null;
  revogadoEm: string | null;
  situacao: SituacaoCredencial;
};
