import { obterAmbiente } from '@/config/ambiente';
import { abrirConteudoAnexo } from '@/servidor/anexos/armazenamentoAnexos';
import { anexarArquivos, removerAnexo } from '@/servidor/anexos/anexosServico';
import { retornarAnexoDaAtividade } from '@/servidor/anexos/consultasAnexos';
import { mensagensAnexos } from '@/servidor/anexos/mensagensAnexos';
import { CODIGOS_ANEXO } from '@/servidor/anexos/validacaoAnexos';
import { CAMPO_ARQUIVO_API, ENDPOINTS_API } from '@/servidor/api/catalogoApi';
import { lerArquivosMultipart } from '@/servidor/api/entradaApi';
import {
  esquemaListaAnexosApi,
  esquemaRemocaoAnexoResultadoApi,
} from '@/servidor/api/esquemasApi';
import {
  criarRotaDoEndpoint,
  lerIdentificadorApi,
  montarOrigemApi,
  respostaApi,
  type ParametrosRotaApi,
} from '@/servidor/api/manipuladorApi';
import {
  exigirAtividadeDetalhada,
  mapearAnexoApi,
} from '@/servidor/api/mapeadoresApi';
import { responderArquivo } from '@/servidor/api/respostasApi';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const STATUS_CRIADO = 201;
const PARAMETRO_ANEXO = 'anexoId';

function lerReferenciaAnexo(parametros: ParametrosRotaApi) {
  return {
    atividadeId: lerIdentificadorApi(parametros),
    anexoId: lerIdentificadorApi(parametros, PARAMETRO_ANEXO),
  };
}

function erroEnvioGrande(): ErroApp {
  return new ErroApp(mensagensAnexos.envioGrande, {
    status: STATUS_ERRO.CORPO_GRANDE_DEMAIS,
    codigo: CODIGOS_ANEXO.ENVIO_GRANDE,
  });
}

function erroAnexoInexistente(): ErroApp {
  return new ErroApp(mensagensAnexos.anexoInexistente, {
    status: STATUS_ERRO.NAO_ENCONTRADO,
    codigo: CODIGOS_ANEXO.ANEXO_INEXISTENTE,
  });
}

export const rotaListarAnexos = criarRotaDoEndpoint(
  ENDPOINTS_API.listarAnexos,
  ({ banco, parametros }) => {
    const { anexos } = exigirAtividadeDetalhada(
      banco,
      lerIdentificadorApi(parametros),
    );
    return respostaApi(esquemaListaAnexosApi, anexos.map(mapearAnexoApi));
  },
);

export const rotaEnviarAnexos = criarRotaDoEndpoint(
  ENDPOINTS_API.enviarAnexos,
  async (execucao) => {
    const atividadeId = lerIdentificadorApi(execucao.parametros);
    const arquivos = await lerArquivosMultipart(
      execucao.requisicao,
      CAMPO_ARQUIVO_API,
      erroEnvioGrande,
    );
    const anexos = anexarArquivos(
      execucao.banco,
      obterAmbiente().diretorioAnexos,
      {
        atividadeId,
        arquivos: arquivos.map((arquivo) => ({ ...arquivo, chave: null })),
      },
      null,
      execucao.agora,
      montarOrigemApi(execucao),
    );
    return respostaApi(esquemaListaAnexosApi, anexos.map(mapearAnexoApi), {
      status: STATUS_CRIADO,
    });
  },
);

export const rotaLerAnexo = criarRotaDoEndpoint(
  ENDPOINTS_API.lerAnexo,
  ({ banco, parametros }) => {
    const { atividadeId, anexoId } = lerReferenciaAnexo(parametros);
    const anexo = retornarAnexoDaAtividade(banco, atividadeId, anexoId);
    const conteudo =
      anexo &&
      abrirConteudoAnexo(
        obterAmbiente().diretorioAnexos,
        anexo.identificadorArquivo,
      );
    if (!anexo || !conteudo) {
      throw erroAnexoInexistente();
    }
    return responderArquivo(anexo, conteudo);
  },
);

export const rotaRemoverAnexo = criarRotaDoEndpoint(
  ENDPOINTS_API.removerAnexo,
  (execucao) => {
    const remocao = lerReferenciaAnexo(execucao.parametros);
    removerAnexo(
      execucao.banco,
      obterAmbiente().diretorioAnexos,
      remocao,
      null,
      execucao.agora,
      montarOrigemApi(execucao),
    );
    return respostaApi(esquemaRemocaoAnexoResultadoApi, {
      anexoId: remocao.anexoId,
    });
  },
);
