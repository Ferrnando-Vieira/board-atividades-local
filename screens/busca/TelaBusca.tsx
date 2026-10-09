import CabecalhoPagina from '@/components/ui/CabecalhoPagina';
import Link from 'next/link';
import Cartao from '@/components/ui/Cartao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { montarRotaAtividade } from '@/config/rotas';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';
import IndicadorPrioridade from '@/screens/atividades/IndicadorPrioridade';
import ListaTags from '@/screens/atividades/ListaTags';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import FormularioBusca from '@/screens/busca/FormularioBusca';
import { textosBusca } from '@/screens/busca/textosBusca';
import { buscarAtividades } from '@/servidor/atividades/consultasAtividades';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { formatarDataComHoraOpcional } from '@/util/DataUtils';

type PropriedadesTelaBusca = {
  acesso: AcessoPainel;
  termo: string;
};

export default function TelaBusca({ acesso, termo }: PropriedadesTelaBusca) {
  const consulta = buscarAtividades(
    obterBancoAplicacao(),
    termo,
    acesso.restricao,
  );
  if (!consulta) {
    return (
      <MensagemAlerta tipo="aviso">
        {textosAplicacao.boardAusente}
      </MensagemAlerta>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <CabecalhoPagina
        titulo={textosBusca.titulo}
        descricao={textosBusca.descricao}
      />
      <FormularioBusca prefixoRotas={acesso.prefixoRotas} termo={termo} />
      {termo === '' ? (
        <p className="text-sm text-texto-suave">{textosBusca.orientacao}</p>
      ) : consulta.resultados.length === 0 ? (
        <Cartao>
          <p className="text-sm text-texto-suave">
            {textosBusca.semResultados}
          </p>
        </Cartao>
      ) : (
        <>
          <p role="status" className="text-xs text-texto-suave">
            {textosBusca.descreverQuantidade(consulta.resultados.length)}
          </p>
          <ul className="flex flex-col gap-3">
            {consulta.resultados.map((resultado) => (
              <li key={resultado.id}>
                <Cartao className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={montarRotaAtividade(
                        resultado.id,
                        acesso.prefixoRotas,
                      )}
                      className="font-medium break-words hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
                    >
                      {resultado.titulo}
                    </Link>
                    <IndicadorPrioridade prioridade={resultado.prioridade} />
                    {resultado.arquivadaEm && (
                      <span className="rounded border border-borda px-1.5 text-xs">
                        {textosBusca.arquivada}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-texto-suave">
                    {textosBusca.rotuloStatus}: {resultado.statusNome} ·{' '}
                    {textosAtividades.descreverSolicitante(
                      resultado.solicitante,
                    )}
                  </p>
                  {resultado.prazoData && (
                    <p className="text-xs text-texto-suave">
                      {textosAtividades.descreverPrazo(
                        formatarDataComHoraOpcional(
                          resultado.prazoData,
                          resultado.prazoHora,
                        ),
                      )}
                    </p>
                  )}
                  <ListaTags tags={resultado.tags} />
                </Cartao>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
