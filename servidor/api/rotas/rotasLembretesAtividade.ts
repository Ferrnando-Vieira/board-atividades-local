import { ENDPOINTS_API } from '@/servidor/api/catalogoApi';
import {
  lerCorpoJson,
  lerParametrosConsulta,
  validarEntradaApi,
} from '@/servidor/api/entradaApi';
import {
  esquemaAtividadeApi,
  esquemaDefinicaoLembreteAtividadeApi,
  esquemaExclusaoLembreteApi,
  esquemaVersaoApi,
} from '@/servidor/api/esquemasApi';
import {
  criarRotaDoEndpoint,
  lerIdentificadorApi,
  respostaApi,
  type ExecucaoApi,
} from '@/servidor/api/manipuladorApi';
import { obterAtividadeApi } from '@/servidor/api/mapeadoresApi';
import type { BancoDados } from '@/servidor/banco/conexao';
import {
  esquemaAlteracaoLembrete,
  esquemaDefinicaoLembrete,
  type AlteracaoLembrete,
} from '@/servidor/lembretes/esquemasLembretes';
import {
  ativarLembrete,
  definirLembrete,
  desativarLembrete,
  excluirLembrete,
} from '@/servidor/lembretes/lembretesServico';

type OperacaoLembreteAtividade = (
  banco: BancoDados,
  alteracao: AlteracaoLembrete,
  agora: Date,
) => unknown;

function responderAtividade({ banco, parametros }: ExecucaoApi) {
  return respostaApi(
    esquemaAtividadeApi,
    obterAtividadeApi(banco, lerIdentificadorApi(parametros)),
  );
}

function criarRotaAlteracaoLembrete(
  endpoint:
    | typeof ENDPOINTS_API.desativarLembreteAtividade
    | typeof ENDPOINTS_API.reativarLembreteAtividade,
  operacao: OperacaoLembreteAtividade,
) {
  return criarRotaDoEndpoint(endpoint, async (execucao) => {
    const { versaoEsperada } = validarEntradaApi(
      esquemaVersaoApi,
      await lerCorpoJson(execucao.requisicao),
    );
    operacao(
      execucao.banco,
      validarEntradaApi(esquemaAlteracaoLembrete, {
        atividadeId: lerIdentificadorApi(execucao.parametros),
        versaoEsperada,
      }),
      execucao.agora,
    );
    return responderAtividade(execucao);
  });
}

export const rotaDefinirLembreteAtividade = criarRotaDoEndpoint(
  ENDPOINTS_API.definirLembreteAtividade,
  async (execucao) => {
    const entrada = validarEntradaApi(
      esquemaDefinicaoLembreteAtividadeApi,
      await lerCorpoJson(execucao.requisicao),
    );
    definirLembrete(
      execucao.banco,
      validarEntradaApi(esquemaDefinicaoLembrete, {
        atividadeId: lerIdentificadorApi(execucao.parametros),
        ...entrada,
      }),
      execucao.agora,
    );
    return responderAtividade(execucao);
  },
);

export const rotaDesativarLembreteAtividade = criarRotaAlteracaoLembrete(
  ENDPOINTS_API.desativarLembreteAtividade,
  desativarLembrete,
);

export const rotaReativarLembreteAtividade = criarRotaAlteracaoLembrete(
  ENDPOINTS_API.reativarLembreteAtividade,
  ativarLembrete,
);

export const rotaExcluirLembreteAtividade = criarRotaDoEndpoint(
  ENDPOINTS_API.excluirLembreteAtividade,
  (execucao) => {
    const { versaoEsperada } = validarEntradaApi(
      esquemaExclusaoLembreteApi,
      lerParametrosConsulta(execucao.requisicao, {
        unicos: ['versaoEsperada'],
      }),
    );
    excluirLembrete(
      execucao.banco,
      validarEntradaApi(esquemaAlteracaoLembrete, {
        atividadeId: lerIdentificadorApi(execucao.parametros),
        versaoEsperada,
      }),
    );
    return responderAtividade(execucao);
  },
);
