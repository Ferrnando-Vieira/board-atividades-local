import { LEMBRETES } from '@/config/constantes';

export type SituacaoNotificacoesNavegador =
  | 'indisponivel'
  | 'contexto-inseguro'
  | 'nao-solicitada'
  | 'concedida'
  | 'negada';

// Subconjunto da Notification API usado pela central. Recebido por
// parâmetro, para que a lógica não dependa do objeto global do navegador.
export type ApiNotificacoes = {
  readonly permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  new (
    titulo: string,
    opcoes?: NotificationOptions,
  ): Pick<Notification, 'onclick'>;
};

export type AmbienteNotificacoes = {
  contextoSeguro: boolean;
  api: ApiNotificacoes | undefined;
};

export type ConteudoNotificacaoNavegador = {
  chave: string;
  titulo: string;
  corpo: string;
};

export type ArmazenamentoChaves = Pick<Storage, 'getItem' | 'setItem'>;

const CHAVE_ARMAZENAMENTO = 'board-atividades:lembretes-exibidos';
const IDIOMA_NOTIFICACAO = 'pt-BR';

const SITUACAO_POR_PERMISSAO: Record<
  NotificationPermission,
  SituacaoNotificacoesNavegador
> = {
  default: 'nao-solicitada',
  granted: 'concedida',
  denied: 'negada',
};

export const AMBIENTE_SEM_NOTIFICACOES: AmbienteNotificacoes = {
  contextoSeguro: false,
  api: undefined,
};

export function lerAmbienteNotificacoes(
  janela: (Window & typeof globalThis) | undefined,
): AmbienteNotificacoes {
  if (!janela) {
    return AMBIENTE_SEM_NOTIFICACOES;
  }
  return {
    contextoSeguro: janela.isSecureContext,
    api: 'Notification' in janela ? janela.Notification : undefined,
  };
}

// O navegador só oferece a Notification API em contexto seguro (HTTPS ou
// localhost); fora dele, e quando a API não existe, os avisos ficam só na
// central dentro da página.
export function avaliarNotificacoesNavegador(
  ambiente: AmbienteNotificacoes,
): SituacaoNotificacoesNavegador {
  if (!ambiente.api) {
    return 'indisponivel';
  }
  if (!ambiente.contextoSeguro) {
    return 'contexto-inseguro';
  }
  return SITUACAO_POR_PERMISSAO[ambiente.api.permission] ?? 'nao-solicitada';
}

// Só deve ser chamada a partir de um clique: o pedido de permissão é sempre
// explícito, e navegadores ignoram pedidos feitos sem gesto do usuário.
export async function solicitarPermissaoNotificacoes(
  ambiente: AmbienteNotificacoes,
): Promise<SituacaoNotificacoesNavegador> {
  const situacao = avaliarNotificacoesNavegador(ambiente);
  if (situacao !== 'nao-solicitada' || !ambiente.api) {
    return situacao;
  }
  try {
    const permissao = await ambiente.api.requestPermission();
    return SITUACAO_POR_PERMISSAO[permissao] ?? 'nao-solicitada';
  } catch {
    return 'negada';
  }
}

// A `tag` com a chave do aviso faz o sistema substituir, em vez de empilhar,
// uma notificação repetida. Alguns navegadores (Chrome no Android) recusam o
// construtor fora de um service worker; nesse caso o aviso fica só na
// central e a função devolve falso.
export function exibirNotificacaoNavegador(
  ambiente: AmbienteNotificacoes,
  conteudo: ConteudoNotificacaoNavegador,
  aoClicar?: () => void,
): boolean {
  if (avaliarNotificacoesNavegador(ambiente) !== 'concedida' || !ambiente.api) {
    return false;
  }
  try {
    const notificacao = new ambiente.api(conteudo.titulo, {
      body: conteudo.corpo,
      tag: conteudo.chave,
      lang: IDIOMA_NOTIFICACAO,
    });
    if (aoClicar) {
      notificacao.onclick = aoClicar;
    }
    return true;
  } catch {
    return false;
  }
}

// O acesso ao localStorage lança erro em alguns modos privados e com
// cookies bloqueados; sem ele vale só a deduplicação feita no servidor.
export function obterArmazenamentoLocal(
  janela: (Window & typeof globalThis) | undefined,
): ArmazenamentoChaves | null {
  try {
    return janela?.localStorage ?? null;
  } catch {
    return null;
  }
}

function ehTexto(valor: unknown): valor is string {
  return typeof valor === 'string';
}

export function lerChavesExibidas(
  armazenamento: ArmazenamentoChaves | null,
): string[] {
  if (!armazenamento) {
    return [];
  }
  try {
    const valor: unknown = JSON.parse(
      armazenamento.getItem(CHAVE_ARMAZENAMENTO) ?? '[]',
    );
    return Array.isArray(valor) ? valor.filter(ehTexto) : [];
  } catch {
    return [];
  }
}

// Guarda só as chaves mais recentes, para o registro não crescer sem fim.
export function registrarChaveExibida(
  armazenamento: ArmazenamentoChaves | null,
  chave: string,
): void {
  if (!armazenamento) {
    return;
  }
  const chaves = [
    ...lerChavesExibidas(armazenamento).filter((item) => item !== chave),
    chave,
  ].slice(-LEMBRETES.MAXIMO_CHAVES_EXIBIDAS_REGISTRADAS);
  try {
    armazenamento.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(chaves));
  } catch {
    // Armazenamento cheio ou bloqueado: a deduplicação do servidor continua.
  }
}

export function filtrarNaoExibidas<T extends { chave: string }>(
  armazenamento: ArmazenamentoChaves | null,
  notificacoes: readonly T[],
): T[] {
  const exibidas = new Set(lerChavesExibidas(armazenamento));
  return notificacoes.filter((notificacao) => !exibidas.has(notificacao.chave));
}
