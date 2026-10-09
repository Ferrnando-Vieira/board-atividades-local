import { LIMITES_TEXTO, type TipoOrigemAlteracao } from '@/config/constantes';

// Quem fez a alteração, gravada em cada evento do histórico. O autor é o
// usuário da sessão administrativa, o nome do link completo ou o nome do
// token da API; scripts de manutenção e testes ficam sem autor.
export type OrigemAlteracao = {
  tipo: TipoOrigemAlteracao;
  autor: string | null;
};

export const ORIGEM_SISTEMA: OrigemAlteracao = { tipo: 'sistema', autor: null };

export function criarOrigemAlteracao(
  tipo: TipoOrigemAlteracao,
  autor: string | null,
): OrigemAlteracao {
  const nome = autor?.trim().slice(0, LIMITES_TEXTO.AUTOR_HISTORICO).trim();
  return { tipo, autor: nome ? nome : null };
}
