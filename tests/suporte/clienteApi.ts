import * as rotaAtividade from '@/app/api/v1/atividades/[id]/route';
import * as rotaArquivar from '@/app/api/v1/atividades/[id]/arquivar/route';
import * as rotaDesarquivar from '@/app/api/v1/atividades/[id]/desarquivar/route';
import * as rotaMoverAtividade from '@/app/api/v1/atividades/[id]/mover/route';
import * as rotaAtividades from '@/app/api/v1/atividades/route';
import * as rotaBoard from '@/app/api/v1/board/route';
import * as rotaDesativarLembrete from '@/app/api/v1/lembretes/[id]/desativar/route';
import * as rotaReativarLembrete from '@/app/api/v1/lembretes/[id]/reativar/route';
import * as rotaUmLembrete from '@/app/api/v1/lembretes/[id]/route';
import * as rotaLembretes from '@/app/api/v1/lembretes/route';
import * as rotaIndice from '@/app/api/v1/route';
import * as rotaSolicitantes from '@/app/api/v1/solicitantes/route';
import * as rotaMoverStatus from '@/app/api/v1/status/[id]/mover/route';
import * as rotaUmStatus from '@/app/api/v1/status/[id]/route';
import * as rotaStatus from '@/app/api/v1/status/route';
import * as rotaUmaTag from '@/app/api/v1/tags/[id]/route';
import * as rotaTags from '@/app/api/v1/tags/route';
import * as rotaInexistente from '@/app/api/[[...caminho]]/route';
import type { MetodoApi } from '@/servidor/api/catalogoApi';
import type { ManipuladorApi } from '@/servidor/api/manipuladorApi';

export type ModuloRotaApi = Record<MetodoApi, ManipuladorApi>;

// Caminhos como no catálogo ({id} literal): o teste de consistência usa
// este mapa para chegar ao route.ts de cada endpoint documentado.
export const MODULOS_ROTA_API: Record<string, ModuloRotaApi> = {
  '/api/v1': rotaIndice,
  '/api/v1/board': rotaBoard,
  '/api/v1/atividades': rotaAtividades,
  '/api/v1/atividades/{id}': rotaAtividade,
  '/api/v1/atividades/{id}/mover': rotaMoverAtividade,
  '/api/v1/atividades/{id}/arquivar': rotaArquivar,
  '/api/v1/atividades/{id}/desarquivar': rotaDesarquivar,
  '/api/v1/lembretes': rotaLembretes,
  '/api/v1/lembretes/{id}': rotaUmLembrete,
  '/api/v1/lembretes/{id}/desativar': rotaDesativarLembrete,
  '/api/v1/lembretes/{id}/reativar': rotaReativarLembrete,
  '/api/v1/status': rotaStatus,
  '/api/v1/status/{id}': rotaUmStatus,
  '/api/v1/status/{id}/mover': rotaMoverStatus,
  '/api/v1/tags': rotaTags,
  '/api/v1/tags/{id}': rotaUmaTag,
  '/api/v1/solicitantes': rotaSolicitantes,
};

export const MODULO_ROTA_INEXISTENTE: ModuloRotaApi = rotaInexistente;

const URL_BASE_TESTE = 'http://127.0.0.1:3000';

export type OpcoesChamadaApi = {
  token?: string;
  cabecalhoAutorizacao?: string;
  corpo?: unknown;
  corpoBruto?: string;
  tipoConteudo?: string;
  consulta?: string;
  parametros?: Record<string, string | string[]>;
};

export type RespostaTesteApi = {
  status: number;
  cabecalhos: Headers;
  corpo: {
    dados?: unknown;
    erro?: {
      codigo: string;
      mensagem: string;
      campos?: Record<string, string[]>;
      gerais?: string[];
    };
  };
};

function montarCabecalhos(opcoes: OpcoesChamadaApi): Headers {
  const cabecalhos = new Headers();
  const autorizacao =
    opcoes.cabecalhoAutorizacao ??
    (opcoes.token ? `Bearer ${opcoes.token}` : undefined);
  if (autorizacao) {
    cabecalhos.set('authorization', autorizacao);
  }
  if (opcoes.corpo !== undefined || opcoes.corpoBruto !== undefined) {
    cabecalhos.set('content-type', opcoes.tipoConteudo ?? 'application/json');
  }
  return cabecalhos;
}

export async function chamarApi(
  modulo: ModuloRotaApi,
  metodo: MetodoApi,
  opcoes: OpcoesChamadaApi = {},
): Promise<RespostaTesteApi> {
  const corpo =
    opcoes.corpoBruto ??
    (opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo));
  const requisicao = new Request(
    `${URL_BASE_TESTE}/api/v1/teste${opcoes.consulta ?? ''}`,
    { method: metodo, headers: montarCabecalhos(opcoes), body: corpo },
  );
  const resposta = await modulo[metodo](requisicao, {
    params: Promise.resolve(opcoes.parametros ?? {}),
  });
  const texto = await resposta.text();
  return {
    status: resposta.status,
    cabecalhos: resposta.headers,
    corpo: texto ? (JSON.parse(texto) as RespostaTesteApi['corpo']) : {},
  };
}
