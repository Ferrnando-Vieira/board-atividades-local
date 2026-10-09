import CabecalhoPagina from '@/components/ui/CabecalhoPagina';
import Cartao from '@/components/ui/Cartao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import type { Aviso } from '@/config/rotas';
import AvisoSucesso from '@/screens/aplicacao/AvisoSucesso';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';
import FormularioNovaTag from '@/screens/tags/FormularioNovaTag';
import ItemTag from '@/screens/tags/ItemTag';
import { textosTags } from '@/screens/tags/textosTags';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  listarSolicitantesGerenciaveis,
  listarTagsGerenciaveis,
} from '@/servidor/classificacao/consultasClassificacao';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';

const ID_LISTA_SOLICITANTES = 'tags-solicitantes-cadastrados';

type PropriedadesTelaTags = {
  acesso: AcessoPainel;
  aviso: Aviso | null;
};

export default function TelaTags({ acesso, aviso }: PropriedadesTelaTags) {
  const banco = obterBancoAplicacao();
  const board = buscarBoardPadrao(banco);
  if (!board) {
    return (
      <MensagemAlerta tipo="aviso">
        {textosAplicacao.boardAusente}
      </MensagemAlerta>
    );
  }
  const tags = listarTagsGerenciaveis(banco, board.id);
  const solicitantes = listarSolicitantesGerenciaveis(banco, board.id);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <datalist id={ID_LISTA_SOLICITANTES}>
        {solicitantes.map((solicitante) => (
          <option key={solicitante.id} value={solicitante.nome} />
        ))}
      </datalist>
      <CabecalhoPagina
        titulo={textosTags.titulo}
        descricao={textosTags.descricao}
      />
      <AvisoSucesso aviso={aviso} />
      <Cartao>
        <FormularioNovaTag
          credencial={acesso.tokenCompartilhamento}
          idListaSolicitantes={ID_LISTA_SOLICITANTES}
        />
      </Cartao>
      <Cartao>
        {tags.length === 0 ? (
          <p className="text-sm text-texto-suave">{textosTags.vazio}</p>
        ) : (
          <ul
            aria-label={textosTags.rotuloLista}
            className="flex flex-col divide-y divide-borda"
          >
            {tags.map((tag) => (
              <ItemTag
                key={tag.id}
                tag={tag}
                credencial={acesso.tokenCompartilhamento}
                idListaSolicitantes={ID_LISTA_SOLICITANTES}
              />
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
