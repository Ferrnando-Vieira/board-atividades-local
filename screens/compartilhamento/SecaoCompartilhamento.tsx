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
  lerChaveLinks,
  resolverCaminhoChaveLinks,
} from '@/servidor/compartilhamento/chaveLinks';
import { consultarLinkPadrao } from '@/servidor/compartilhamento/linkPadrao';
import {
  consultarTokensLinks,
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
  url: string | null,
): LinkExibido {
  return {
    id: link.id,
    nome: link.nome,
    modalidade: link.modalidade,
    padrao: link.padrao,
    incluirArquivadas: link.incluirArquivadas,
    animal: link.animal,
    tags: link.tags,
    solicitantes: link.solicitantes,
    criadoEm: formatarInstanteParaExibicao(link.criadoEm, fuso),
    expiraEm: formatarInstanteOpcional(link.expiraEm, fuso),
    ultimoAcessoEm: formatarInstanteOpcional(link.ultimoAcessoEm, fuso),
    situacao: link.situacao,
    url,
  };
}

function lerChaveExistente(): Buffer | null {
  return lerChaveLinks(
    resolverCaminhoChaveLinks(obterAmbiente().caminhoBancoSqlite),
  );
}

// Só leitura: a chave não é criada aqui (isso fica para a inicialização, a
// criação de links e os botões de ativação). Sem chave ou sem link que
// confira, o painel oferece gerar um endereço novo em vez de exibir o antigo.
function montarUrlLinkPadrao(
  banco: BancoDados,
  boardId: number,
  chave: Buffer | null,
  urlBase: string,
): string | null {
  const link = chave ? consultarLinkPadrao(banco, boardId, chave) : null;
  return link ? montarUrlCompartilhamento(urlBase, link.token) : null;
}

function montarUrlsLinks(
  banco: BancoDados,
  boardId: number,
  chave: Buffer | null,
  urlBase: string,
): Map<number, string> {
  const tokens = chave
    ? consultarTokensLinks(banco, boardId, chave)
    : new Map<number, string>();
  return new Map(
    [...tokens].map(([linkId, token]) => [
      linkId,
      montarUrlCompartilhamento(urlBase, token),
    ]),
  );
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
  const chave = lerChaveExistente();
  const urlLinkPadrao = montarUrlLinkPadrao(banco, board.id, chave, urlBase);
  const urlsLinks = montarUrlsLinks(banco, board.id, chave, urlBase);
  return (
    <PainelCompartilhamento
      urlBase={urlBase}
      somenteLocal={ehEnderecoSomenteLocal(urlBase)}
      urlLinkPadrao={urlLinkPadrao}
      links={listarLinksCompartilhamento(banco, board.id).map((link) =>
        prepararParaExibicao(
          link,
          board.fusoHorario,
          link.padrao ? urlLinkPadrao : (urlsLinks.get(link.id) ?? null),
        ),
      )}
      tags={listarTagsGerenciaveis(banco, board.id)}
      solicitantes={listarSolicitantesGerenciaveis(banco, board.id)}
    />
  );
}
