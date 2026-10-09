import { PREFIXO_API } from '@/config/rotas';
import { ENDPOINTS_API } from '@/servidor/api/catalogoApi';
import {
  lerCorpoJson,
  lerParametrosConsulta,
  validarEntradaApi,
} from '@/servidor/api/entradaApi';
import {
  esquemaAtualizacaoLembreteApi,
  esquemaConsultaLembretesApi,
  esquemaCriacaoLembreteApi,
  esquemaExclusaoLembreteApi,
  esquemaExclusaoLembreteResultadoApi,
  esquemaLembreteApi,
  esquemaListaLembretesApi,
  esquemaVersaoApi,
} from '@/servidor/api/esquemasApi';
import {
  criarRotaDoEndpoint,
  lerIdentificadorApi,
  respostaApi,
} from '@/servidor/api/manipuladorApi';
import {
  listarLembretesApi,
  obterLembreteApi,
} from '@/servidor/api/mapeadoresApi';
import {
  esquemaAlteracaoLembreteAvulso,
  esquemaEdicaoLembreteAvulso,
  esquemaNovoLembreteAvulso,
} from '@/servidor/lembretes/esquemasLembretes';
import {
  cancelarLembreteAvulso,
  criarLembreteAvulso,
  editarLembreteAvulso,
  excluirLembreteAvulso,
  reativarLembreteAvulso,
} from '@/servidor/lembretes/lembretesAvulsosServico';

const STATUS_CRIADO = 201;

export const rotaListarLembretes = criarRotaDoEndpoint(
  ENDPOINTS_API.listarLembretes,
  ({ banco, requisicao }) => {
    const { situacao } = validarEntradaApi(
      esquemaConsultaLembretesApi,
      lerParametrosConsulta(requisicao, { unicos: ['situacao'] }),
    );
    return respostaApi(
      esquemaListaLembretesApi,
      listarLembretesApi(banco).filter(
        (lembrete) => situacao === undefined || lembrete.situacao === situacao,
      ),
    );
  },
);

export const rotaCriarLembrete = criarRotaDoEndpoint(
  ENDPOINTS_API.criarLembrete,
  async ({ banco, requisicao, agora }) => {
    const entrada = validarEntradaApi(
      esquemaCriacaoLembreteApi,
      await lerCorpoJson(requisicao),
    );
    const { lembreteId } = criarLembreteAvulso(
      banco,
      validarEntradaApi(esquemaNovoLembreteAvulso, {
        titulo: entrada.titulo,
        observacao: entrada.observacao ?? null,
        lembreteData: entrada.lembreteData,
        lembreteHora: entrada.lembreteHora,
      }),
      agora,
    );
    return respostaApi(
      esquemaLembreteApi,
      obterLembreteApi(banco, lembreteId),
      {
        status: STATUS_CRIADO,
        cabecalhos: { Location: `${PREFIXO_API}/lembretes/${lembreteId}` },
      },
    );
  },
);

export const rotaLerLembrete = criarRotaDoEndpoint(
  ENDPOINTS_API.lerLembrete,
  ({ banco, parametros }) =>
    respostaApi(
      esquemaLembreteApi,
      obterLembreteApi(banco, lerIdentificadorApi(parametros)),
    ),
);

// Como na interface, editar remarca: o lembrete volta a pendente e o horário
// resultante precisa ser futuro, mesmo que só o título tenha mudado num
// lembrete que já passou. O que não é enviado fica como está.
export const rotaAtualizarLembrete = criarRotaDoEndpoint(
  ENDPOINTS_API.atualizarLembrete,
  async ({ banco, requisicao, parametros, agora }) => {
    const lembreteId = lerIdentificadorApi(parametros);
    const entrada = validarEntradaApi(
      esquemaAtualizacaoLembreteApi,
      await lerCorpoJson(requisicao),
    );
    const atual = obterLembreteApi(banco, lembreteId);
    editarLembreteAvulso(
      banco,
      validarEntradaApi(esquemaEdicaoLembreteAvulso, {
        lembreteId,
        versaoEsperada: entrada.versaoEsperada,
        titulo: entrada.titulo ?? atual.titulo,
        observacao:
          entrada.observacao === undefined
            ? atual.observacao
            : entrada.observacao,
        lembreteData: entrada.lembreteData ?? atual.lembreteData,
        lembreteHora: entrada.lembreteHora ?? atual.lembreteHora,
      }),
      agora,
    );
    return respostaApi(esquemaLembreteApi, obterLembreteApi(banco, lembreteId));
  },
);

export const rotaDesativarLembrete = criarRotaDoEndpoint(
  ENDPOINTS_API.desativarLembrete,
  async ({ banco, requisicao, parametros }) => {
    const lembreteId = lerIdentificadorApi(parametros);
    const { versaoEsperada } = validarEntradaApi(
      esquemaVersaoApi,
      await lerCorpoJson(requisicao),
    );
    cancelarLembreteAvulso(
      banco,
      validarEntradaApi(esquemaAlteracaoLembreteAvulso, {
        lembreteId,
        versaoEsperada,
      }),
    );
    return respostaApi(esquemaLembreteApi, obterLembreteApi(banco, lembreteId));
  },
);

export const rotaReativarLembrete = criarRotaDoEndpoint(
  ENDPOINTS_API.reativarLembrete,
  async ({ banco, requisicao, parametros, agora }) => {
    const lembreteId = lerIdentificadorApi(parametros);
    const { versaoEsperada } = validarEntradaApi(
      esquemaVersaoApi,
      await lerCorpoJson(requisicao),
    );
    reativarLembreteAvulso(
      banco,
      validarEntradaApi(esquemaAlteracaoLembreteAvulso, {
        lembreteId,
        versaoEsperada,
      }),
      agora,
    );
    return respostaApi(esquemaLembreteApi, obterLembreteApi(banco, lembreteId));
  },
);

export const rotaExcluirLembrete = criarRotaDoEndpoint(
  ENDPOINTS_API.excluirLembrete,
  ({ banco, requisicao, parametros }) => {
    const lembreteId = lerIdentificadorApi(parametros);
    const { versaoEsperada } = validarEntradaApi(
      esquemaExclusaoLembreteApi,
      lerParametrosConsulta(requisicao, { unicos: ['versaoEsperada'] }),
    );
    excluirLembreteAvulso(
      banco,
      validarEntradaApi(esquemaAlteracaoLembreteAvulso, {
        lembreteId,
        versaoEsperada,
      }),
    );
    return respostaApi(esquemaExclusaoLembreteResultadoApi, { lembreteId });
  },
);
