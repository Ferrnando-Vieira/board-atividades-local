import CabecalhoPagina from '@/components/ui/CabecalhoPagina';
import Cartao from '@/components/ui/Cartao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import type { Aviso } from '@/config/rotas';
import AvisoSucesso from '@/screens/aplicacao/AvisoSucesso';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';
import FormularioNovoStatus from '@/screens/status/FormularioNovoStatus';
import ItemStatus from '@/screens/status/ItemStatus';
import { textosStatus } from '@/screens/status/textosStatus';
import { montarAparenciaPainel } from '@/servidor/board/aparenciaBoard';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';
import { listarStatusGerenciaveis } from '@/servidor/board/consultaQuadro';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';

type PropriedadesTelaStatus = {
  acesso: AcessoPainel;
  aviso: Aviso | null;
};

export default function TelaStatus({ acesso, aviso }: PropriedadesTelaStatus) {
  const banco = obterBancoAplicacao();
  const board = buscarBoardPadrao(banco);
  if (!board) {
    return (
      <MensagemAlerta tipo="aviso">
        {textosAplicacao.boardAusente}
      </MensagemAlerta>
    );
  }
  const status = listarStatusGerenciaveis(banco, board.id);
  const ordemAtual = status.map((item) => item.id);
  const { superficies, amostrasFundo } = montarAparenciaPainel(
    banco,
    acesso.prefixoRotas,
  );
  const aparenciaPadrao = { superficies, amostrasFundo };
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <CabecalhoPagina
        titulo={textosStatus.titulo}
        descricao={textosStatus.descricao}
      />
      <AvisoSucesso aviso={aviso} />
      <Cartao>
        <FormularioNovoStatus
          credencial={acesso.tokenCompartilhamento}
          aparenciaPadrao={aparenciaPadrao}
        />
      </Cartao>
      <ol className="flex flex-col gap-3">
        {status.map((item, indice) => (
          <ItemStatus
            key={item.id}
            status={item}
            indice={indice}
            ordemAtual={ordemAtual}
            credencial={acesso.tokenCompartilhamento}
            aparenciaPadrao={aparenciaPadrao}
            destinos={status
              .filter((destino) => destino.id !== item.id)
              .map((destino) => ({ id: destino.id, nome: destino.nome }))}
          />
        ))}
      </ol>
    </div>
  );
}
