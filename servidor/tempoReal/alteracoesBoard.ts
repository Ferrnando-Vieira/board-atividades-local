// Aviso de que algo no board mudou, entregue às abas abertas por SSE. O aviso
// não carrega dados: cada aba recarrega a tela com o próprio acesso, então um
// link restrito nunca recebe o que não poderia ver. Vive só na memória do
// processo do servidor (o board roda num único processo), como a presença.
export const TEMPO_REAL = {
  // Teto de conexões abertas, contra abas esquecidas ou conexões forjadas.
  MAXIMO_OUVINTES: 200,
} as const;

export type OuvinteAlteracoes = (revisao: number) => void;

export type CanalAlteracoes = {
  revisao: number;
  ouvintes: Set<OuvinteAlteracoes>;
};

export function criarCanalAlteracoes(): CanalAlteracoes {
  return { revisao: 0, ouvintes: new Set() };
}

// Devolve a função que cancela a assinatura, ou null quando o teto de
// conexões já foi atingido.
export function assinarAlteracoes(
  canal: CanalAlteracoes,
  ouvinte: OuvinteAlteracoes,
): (() => void) | null {
  if (canal.ouvintes.size >= TEMPO_REAL.MAXIMO_OUVINTES) {
    return null;
  }
  canal.ouvintes.add(ouvinte);
  return () => {
    canal.ouvintes.delete(ouvinte);
  };
}

// Uma conexão com problema não impede o aviso de chegar às demais.
export function publicarAlteracao(canal: CanalAlteracoes): void {
  canal.revisao += 1;
  for (const ouvinte of canal.ouvintes) {
    try {
      ouvinte(canal.revisao);
    } catch {
      canal.ouvintes.delete(ouvinte);
    }
  }
}

const CHAVE_GLOBAL_ALTERACOES = '__boardAtividadesAlteracoes';

type GlobalComAlteracoes = typeof globalThis & {
  [CHAVE_GLOBAL_ALTERACOES]?: CanalAlteracoes;
};

// `next dev` reavalia módulos a cada edição, e ações, rotas da API e rotas de
// eventos podem ficar em pacotes separados; em globalThis todos usam o mesmo
// canal.
export function obterCanalAlteracoes(): CanalAlteracoes {
  const escopoGlobal = globalThis as GlobalComAlteracoes;
  escopoGlobal[CHAVE_GLOBAL_ALTERACOES] ??= criarCanalAlteracoes();
  return escopoGlobal[CHAVE_GLOBAL_ALTERACOES];
}

export function publicarAlteracaoBoard(): void {
  publicarAlteracao(obterCanalAlteracoes());
}
