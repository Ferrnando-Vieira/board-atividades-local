import CabecalhoPagina from '@/components/ui/CabecalhoPagina';
import Cartao from '@/components/ui/Cartao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';
import FormularioSolicitantePadrao from '@/screens/solicitantes/FormularioSolicitantePadrao';
import { textosSolicitantes as textos } from '@/screens/solicitantes/textosSolicitantes';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';
import { listarSolicitantesGerenciaveis } from '@/servidor/classificacao/consultasClassificacao';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';

// Tela só do proprietário (a página confere a sessão).
export default function TelaSolicitantes() {
  const banco = obterBancoAplicacao();
  const board = buscarBoardPadrao(banco);
  if (!board) {
    return (
      <MensagemAlerta tipo="aviso">
        {textosAplicacao.boardAusente}
      </MensagemAlerta>
    );
  }
  const solicitantes = listarSolicitantesGerenciaveis(banco, board.id);
  const padrao = solicitantes.find((solicitante) => solicitante.padrao);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <CabecalhoPagina titulo={textos.titulo} descricao={textos.descricao} />
      <Cartao>
        <FormularioSolicitantePadrao
          padraoAtual={padrao?.nome ?? null}
          nomesCadastrados={solicitantes.map((solicitante) => solicitante.nome)}
        />
      </Cartao>
      <Cartao className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{textos.tituloLista}</h2>
        {solicitantes.length === 0 ? (
          <p className="text-sm text-texto-suave">{textos.vazio}</p>
        ) : (
          <ul
            aria-label={textos.rotuloLista}
            className="flex flex-col divide-y divide-borda"
          >
            {solicitantes.map((solicitante) => (
              <li
                key={solicitante.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium break-words">
                  {solicitante.nome}
                  {solicitante.padrao && (
                    <span className="rounded-full bg-primaria-suave px-2 py-0.5 text-xs font-semibold text-primaria-escura">
                      {textos.seloPadrao}
                    </span>
                  )}
                </span>
                <span className="text-xs text-texto-suave">
                  {textos.descreverUso(solicitante.quantidadeAtividades)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
