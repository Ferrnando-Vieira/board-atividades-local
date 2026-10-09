'use server';

import { CAMPOS_ANEXO } from '@/config/camposFormulario';
import { obterAmbiente } from '@/config/ambiente';
import { LIMITES_ANEXO } from '@/config/anexos';
import { anexarArquivos, removerAnexo } from '@/servidor/anexos/anexosServico';
import {
  esquemaEnvioAnexo,
  esquemaRemocaoAnexo,
} from '@/servidor/anexos/esquemasAnexos';
import { mensagensAnexos as mensagens } from '@/servidor/anexos/mensagensAnexos';
import {
  CODIGOS_ANEXO,
  exigirTamanhoAnexoPermitido,
} from '@/servidor/anexos/validacaoAnexos';
import {
  estadoDeFalhaNegocio,
  estadoDeFalhaValidacao,
  estadoDeSucesso,
  lerCredencialFormulario,
  revalidarPainel,
} from '@/servidor/web/acoes/suporteAcoes';
import {
  exigirAcessoGestao,
  montarOrigemAlteracao,
} from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type { EstadoFormularioGestao } from '@/types/formulario';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { lerValoresFormulario } from '@/util/FormularioUtils';

const SEM_VALORES = {};

const CAMPOS_REMOCAO = [CAMPOS_ANEXO.ATIVIDADE_ID, CAMPOS_ANEXO.ANEXO_ID];

// Sem arquivo escolhido o navegador envia um File vazio e sem nome. O
// tamanho de cada arquivo e a quantidade são conferidos antes de ler os
// bytes; o serviço confere tudo de novo.
function lerArquivosEnviados(dados: FormData): File[] {
  const arquivos = dados
    .getAll(CAMPOS_ANEXO.ARQUIVO)
    .filter(
      (arquivo): arquivo is File =>
        arquivo instanceof File && arquivo.name !== '',
    );
  if (arquivos.length === 0) {
    throw new ErroApp(mensagens.arquivoAusente, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ANEXO.ARQUIVO_AUSENTE,
    });
  }
  if (arquivos.length > LIMITES_ANEXO.MAXIMO_POR_ENVIO) {
    throw new ErroApp(mensagens.arquivosDemais, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ANEXO.ARQUIVOS_DEMAIS,
    });
  }
  for (const arquivo of arquivos) {
    exigirTamanhoAnexoPermitido(arquivo.size);
  }
  return arquivos;
}

// Mesma barreira das demais ações de gestão: sessão administrativa ou link
// completo válido nesta requisição. Link restrito volta ao quadro somente
// leitura e link inválido vai para a página de indisponível, sem gravar.
export async function enviarAnexoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, [CAMPOS_ANEXO.ATIVIDADE_ID]);
  const validacao = esquemaEnvioAnexo.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      SEM_VALORES,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  let quantidade: number;
  try {
    const arquivos = lerArquivosEnviados(dados);
    quantidade = arquivos.length;
    anexarArquivos(
      obterBancoAplicacao(),
      obterAmbiente().diretorioAnexos,
      {
        atividadeId: validacao.data.atividadeId,
        arquivos: await Promise.all(
          arquivos.map(async (arquivo) => ({
            nomeArquivo: arquivo.name,
            conteudo: new Uint8Array(await arquivo.arrayBuffer()),
            chave: null,
          })),
        ),
      },
      acesso.restricao,
      new Date(),
      montarOrigemAlteracao(acesso),
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, SEM_VALORES, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(
    estado,
    quantidade === 1
      ? mensagens.anexoEnviado
      : mensagens.anexosEnviados(quantidade),
  );
}

export async function removerAnexoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, CAMPOS_REMOCAO);
  const validacao = esquemaRemocaoAnexo.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      SEM_VALORES,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    removerAnexo(
      obterBancoAplicacao(),
      obterAmbiente().diretorioAnexos,
      validacao.data,
      acesso.restricao,
      new Date(),
      montarOrigemAlteracao(acesso),
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, SEM_VALORES, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.anexoRemovido);
}
