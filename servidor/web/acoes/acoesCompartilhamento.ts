'use server';

import { obterAmbiente, obterUrlBaseLan } from '@/config/ambiente';
import { CAMPOS_COMPARTILHAMENTO } from '@/config/camposFormulario';
import { montarUrlCompartilhamento } from '@/config/rotas';
import {
  CAMPOS_ANIMAL_LINK,
  CAMPOS_LISTA_NOVO_LINK,
  CAMPOS_TEXTO_EDICAO_LINK,
  CAMPOS_TEXTO_NOVO_LINK,
  esquemaAnimalLink,
  esquemaEdicaoLink,
  esquemaNovoLink,
  esquemaReferenciaLink,
} from '@/servidor/compartilhamento/esquemasCompartilhamento';
import {
  obterOuCriarChaveLinks,
  resolverCaminhoChaveLinks,
} from '@/servidor/compartilhamento/chaveLinks';
import {
  garantirLinkPadrao,
  renovarLinkPadrao,
} from '@/servidor/compartilhamento/linkPadrao';
import {
  criarLinkCompartilhamento,
  definirAnimalLink,
  editarLinkCompartilhamento,
  revogarLinkCompartilhamento,
  tornarEnderecoCopiavel,
  type LinkCriado,
} from '@/servidor/compartilhamento/linksServico';
import { mensagensCompartilhamento as mensagens } from '@/servidor/compartilhamento/mensagensCompartilhamento';
import { exigirSessaoAdministrativa } from '@/servidor/web/acessoAdministrativo';
import {
  estadoDeFalhaNegocio,
  estadoDeFalhaValidacao,
  estadoDeSucesso,
  revalidarPainel,
} from '@/servidor/web/acoes/suporteAcoes';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type {
  EstadoCriacaoCredencial,
  EstadoFormularioGestao,
} from '@/types/formulario';
import { lerValoresFormulario } from '@/util/FormularioUtils';

const CAMPOS_REFERENCIA_LINK = [CAMPOS_COMPARTILHAMENTO.LINK_ID] as const;

function obterChaveParaGravacao(): Buffer {
  return obterOuCriarChaveLinks(
    resolverCaminhoChaveLinks(obterAmbiente().caminhoBancoSqlite),
  );
}

// Administrar links é exclusivo da sessão administrativa: estas ações não
// aceitam credencial de link, nem mesmo de link completo.
export async function criarLinkCompartilhamentoFormulario(
  estado: EstadoCriacaoCredencial,
  dados: FormData,
): Promise<EstadoCriacaoCredencial> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(
    dados,
    CAMPOS_TEXTO_NOVO_LINK,
    CAMPOS_LISTA_NOVO_LINK,
  );
  const validacao = esquemaNovoLink.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  let criado: LinkCriado;
  try {
    criado = criarLinkCompartilhamento(
      obterBancoAplicacao(),
      validacao.data,
      obterChaveParaGravacao(),
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return {
    ...estadoDeSucesso(estado, mensagens.linkCriado),
    credencialGerada: montarUrlCompartilhamento(
      obterUrlBaseLan(),
      criado.token,
    ),
  };
}

export async function revogarLinkCompartilhamentoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_REFERENCIA_LINK);
  const validacao = esquemaReferenciaLink.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    revogarLinkCompartilhamento(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.linkRevogado);
}

export async function definirAnimalLinkFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_ANIMAL_LINK);
  const validacao = esquemaAnimalLink.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.animalInvalido,
    );
  }
  try {
    definirAnimalLink(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.animalDefinido);
}

export async function editarLinkCompartilhamentoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(
    dados,
    CAMPOS_TEXTO_EDICAO_LINK,
    CAMPOS_LISTA_NOVO_LINK,
  );
  const validacao = esquemaEdicaoLink.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  try {
    editarLinkCompartilhamento(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.linkEditado);
}

export async function tornarEnderecoCopiavelFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_REFERENCIA_LINK);
  const validacao = esquemaReferenciaLink.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    tornarEnderecoCopiavel(
      obterBancoAplicacao(),
      validacao.data,
      obterChaveParaGravacao(),
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.enderecoCopiavelGerado);
}

// O link padrão também é administração de links: só a sessão do proprietário
// ativa ou troca o endereço; quem tem o link nunca chega a estas ações.
export async function ativarLinkPadraoFormulario(
  estado: EstadoFormularioGestao,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  try {
    garantirLinkPadrao(obterBancoAplicacao(), obterChaveParaGravacao());
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, {}, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.linkPadraoAtivado);
}

export async function renovarLinkPadraoFormulario(
  estado: EstadoFormularioGestao,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  try {
    renovarLinkPadrao(obterBancoAplicacao(), obterChaveParaGravacao());
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, {}, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.linkPadraoRenovado);
}
