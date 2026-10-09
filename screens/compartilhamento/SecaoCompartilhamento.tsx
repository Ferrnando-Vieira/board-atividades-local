import { obterAmbiente, obterUrlBaseLan } from '@/config/ambiente';
import { ehEnderecoSomenteLocal } from '@/config/rede';
import { montarUrlCompartilhamento } from '@/config/rotas';
import PainelCompartilhamento from '@/screens/compartilhamento/PainelCompartilhamento';
import type { LinkExibido } from '@/screens/compartilhamento/tiposCompartilhamento';
import type { BancoDados } from '@/servidor/banco/conexao';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  listarSolicitantesGerenciaveis,
  listarTagsGerenciaveis,
} from '@/servidor/classificacao/consultasClassificacao';
import {
  consultarLinkPadrao,
  lerChaveLinkPadrao,
  resolverCaminhoChaveLinkPadrao,
} from '@/servidor/compartilhamento/linkPadrao';
import {
  listarLinksCompartilhamento,
  type LinkCompartilhamentoResumo,
} from '@/servidor/compartilhamento/linksServico';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  formatarInstanteOpcional,
  formatarInstanteParaExibicao,
} from '@/util/DataUtils';

function prepararParaExibicao(
  link: LinkCompartilhamentoResumo,
  fuso: string,
): LinkExibido {
  return {
    id: link.id,
    nome: link.nome,
    modalidade: link.modalidade,
    padrao: link.padrao,
    incluirArquivadas: link.incluirArquivadas,
    animal: link.animal,
    tags: link.tags.map((tag) => tag.nome),
    solicitantes: link.solicitantes.map((solicitante) => solicitante.nome),
    criadoEm: formatarInstanteParaExibicao(link.criadoEm, fuso),
    expiraEm: formatarInstanteOpcional(link.expiraEm, fuso),
    ultimoAcessoEm: formatarInstanteOpcional(link.ultimoAcessoEm, fuso),
    revogadoEm: formatarInstanteOpcional(link.revogadoEm, fuso),
    situacao: link.situacao,
  };
}

// Só leitura: a chave não é criada aqui (isso fica para a inicialização e o
// botão de ativação). Sem chave ou sem link que confira, o painel oferece a
// ativação em vez do endereço.
function montarUrlLinkPadrao(
  banco: BancoDados,
  boardId: number,
): string | null {
  const ambiente = obterAmbiente();
  const chave = lerChaveLinkPadrao(
    resolverCaminhoChaveLinkPadrao(ambiente.caminhoBancoSqlite),
  );
  const link = chave ? consultarLinkPadrao(banco, boardId, chave) : null;
  return link ? montarUrlCompartilhamento(obterUrlBaseLan(), link.token) : null;
}

// Renderizada só para o administrador: a página do link nunca carrega a
// lista de links, de tags nem de solicitantes do board.
export default function SecaoCompartilhamento() {
  const banco = obterBancoAplicacao();
  const board = buscarBoardPadrao(banco);
  if (!board) {
    return null;
  }
  const urlBase = obterUrlBaseLan();
  return (
    <PainelCompartilhamento
      urlBase={urlBase}
      somenteLocal={ehEnderecoSomenteLocal(urlBase)}
      urlLinkPadrao={montarUrlLinkPadrao(banco, board.id)}
      links={listarLinksCompartilhamento(banco, board.id).map((link) =>
        prepararParaExibicao(link, board.fusoHorario),
      )}
      tags={listarTagsGerenciaveis(banco, board.id)}
      solicitantes={listarSolicitantesGerenciaveis(banco, board.id)}
    />
  );
}
