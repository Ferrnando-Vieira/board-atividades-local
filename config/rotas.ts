import { LIMITES_TEXTO } from '@/config/constantes';

export const ROTAS = {
  INICIO: '/',
  ENTRAR: '/entrar',
  CONFIGURACAO_INICIAL: '/configuracao-inicial',
  NOVA_ATIVIDADE: '/atividades/nova',
  ARQUIVADAS: '/arquivadas',
  STATUS: '/status',
  TAGS: '/tags',
  SOLICITANTES: '/solicitantes',
  BUSCA: '/busca',
  INTEGRACOES: '/integracoes',
  APARENCIA: '/aparencia',
  LEMBRETES: '/lembretes',
  COMPARTILHAMENTO_INDISPONIVEL: '/compartilhado',
} as const;

export const PREFIXO_ROTAS_COMPARTILHAMENTO = '/compartilhado';

const ROTA_IMAGEM_FUNDO = '/fundo';

export const PREFIXO_API = '/api/v1';

export const PARAMETRO_CONFIGURACAO_CONCLUIDA = 'configuracao';
export const VALOR_CONFIGURACAO_CONCLUIDA = 'concluida';

export const PARAMETRO_STATUS_INICIAL = 'status';
export const PARAMETRO_AVISO = 'aviso';
export const PARAMETRO_BUSCA = 'q';

export const AVISOS = {
  ATIVIDADE_CRIADA: 'atividade-criada',
  ATIVIDADE_SALVA: 'atividade-salva',
  ATIVIDADE_ARQUIVADA: 'atividade-arquivada',
  ATIVIDADE_RESTAURADA: 'atividade-restaurada',
  STATUS_EXCLUIDO: 'status-excluido',
  TAG_EXCLUIDA: 'tag-excluida',
} as const;

export type Aviso = (typeof AVISOS)[keyof typeof AVISOS];

const VALORES_AVISO: readonly string[] = Object.values(AVISOS);

function ehAviso(valor: unknown): valor is Aviso {
  return typeof valor === 'string' && VALORES_AVISO.includes(valor);
}

// Só valores conhecidos viram aviso: o texto exibido vem sempre do mapa de
// textos, nunca do parâmetro da URL.
export function lerAviso(valor: string | string[] | undefined): Aviso | null {
  return ehAviso(valor) ? valor : null;
}

export function adicionarAviso(rota: string, aviso: Aviso): string {
  return `${rota}?${PARAMETRO_AVISO}=${aviso}`;
}

// Parâmetro repetido usa só o primeiro valor; o excesso é cortado para que
// uma URL enorme não vire uma busca enorme.
export function lerTermoBusca(valor: string | string[] | undefined): string {
  const termo = Array.isArray(valor) ? valor[0] : valor;
  return (termo ?? '').trim().slice(0, LIMITES_TEXTO.TERMO_BUSCA);
}

const FORMATO_IDENTIFICADOR = /^[1-9]\d*$/;

// Aceita só inteiros positivos escritos sem sinal, espaço ou expoente, para
// que "/atividades/1e3" ou "/atividades/ 7" não apontem para outra atividade.
export function lerIdentificadorRota(
  valor: string | string[] | undefined,
): number | null {
  if (typeof valor !== 'string' || !FORMATO_IDENTIFICADOR.test(valor)) {
    return null;
  }
  const identificador = Number(valor);
  return Number.isSafeInteger(identificador) ? identificador : null;
}

// As telas do painel servem ao administrador (prefixo vazio) e aos links de
// compartilhamento (prefixo com o token); todo link interno passa por aqui
// para que a navegação continue dentro do mesmo acesso.
export function montarPrefixoCompartilhamento(token: string): string {
  return `${PREFIXO_ROTAS_COMPARTILHAMENTO}/${encodeURIComponent(token)}`;
}

export function aplicarPrefixo(prefixo: string, rota: string): string {
  if (prefixo === '') {
    return rota;
  }
  return rota === ROTAS.INICIO ? prefixo : `${prefixo}${rota}`;
}

export function montarRotaAtividade(atividadeId: number, prefixo = ''): string {
  return aplicarPrefixo(prefixo, `/atividades/${atividadeId}`);
}

// Endereço dos cartões do quadro: só ele é interceptado (app/@modal) e abre
// a atividade num modal sobre o quadro. As demais navegações até a atividade
// (busca, edição, lembretes, ações) continuam na página completa, e abrir
// este endereço direto (nova aba, recarga) também leva a ela.
export function montarRotaAtividadeNoQuadro(
  atividadeId: number,
  prefixo = '',
): string {
  return aplicarPrefixo(prefixo, `/quadro/atividades/${atividadeId}`);
}

export function montarRotaEdicaoAtividade(
  atividadeId: number,
  prefixo = '',
): string {
  return aplicarPrefixo(prefixo, `/atividades/${atividadeId}/editar`);
}

export function montarRotaNovaAtividade(
  statusId?: number,
  prefixo = '',
): string {
  const rota = aplicarPrefixo(prefixo, ROTAS.NOVA_ATIVIDADE);
  return statusId === undefined
    ? rota
    : `${rota}?${PARAMETRO_STATUS_INICIAL}=${statusId}`;
}

export function montarRotaAnexo(anexoId: number, prefixo = ''): string {
  return aplicarPrefixo(prefixo, `/anexos/${anexoId}`);
}

// Exibição na página (miniatura e imagem da descrição), só para imagens; o
// endereço acima continua sendo o download.
export function montarRotaImagemAnexo(anexoId: number, prefixo = ''): string {
  return `${montarRotaAnexo(anexoId, prefixo)}/imagem`;
}

// A versão (hash da imagem) muda o endereço a cada troca, então o navegador
// pode guardar a imagem em cache sem nunca exibir uma antiga.
export function montarRotaImagemFundo(versao: string, prefixo = ''): string {
  return `${aplicarPrefixo(prefixo, ROTA_IMAGEM_FUNDO)}?v=${encodeURIComponent(versao)}`;
}

export function montarUrlCompartilhamento(
  urlBase: string,
  token: string,
): string {
  return `${urlBase.replace(/\/+$/, '')}${montarPrefixoCompartilhamento(token)}`;
}
