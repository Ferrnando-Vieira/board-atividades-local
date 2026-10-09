const SEPARADOR_CHAVE = '@';
// Prefixo que separa as chaves dos lembretes avulsos das de atividade (os
// identificadores das duas tabelas podem coincidir).
const PREFIXO_CHAVE_AVULSO = 'avulso-';

// Um aviso é identificado pelo lembrete (atividade) e pelo instante: remarcar
// gera outra chave, e a mesma chave nunca é exibida duas vezes no navegador.
export function montarChaveNotificacaoLembrete(
  atividadeId: number,
  lembreteEm: string,
): string {
  return `${atividadeId}${SEPARADOR_CHAVE}${lembreteEm}`;
}

export function montarChaveNotificacaoLembreteAvulso(
  lembreteId: number,
  lembreteEm: string,
): string {
  return `${PREFIXO_CHAVE_AVULSO}${lembreteId}${SEPARADOR_CHAVE}${lembreteEm}`;
}
