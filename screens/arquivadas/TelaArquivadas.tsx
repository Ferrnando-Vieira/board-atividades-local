import CabecalhoPagina from '@/components/ui/CabecalhoPagina';
import Link from 'next/link';
import Cartao from '@/components/ui/Cartao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { RETORNOS_RESTAURACAO } from '@/config/camposFormulario';
import { montarRotaAtividade, type Aviso } from '@/config/rotas';
import AvisoSucesso from '@/screens/aplicacao/AvisoSucesso';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';
import { textosArquivadas } from '@/screens/arquivadas/textosArquivadas';
import FormularioArquivamento from '@/screens/atividades/FormularioArquivamento';
import IndicadorPrioridade from '@/screens/atividades/IndicadorPrioridade';
import ListaTags from '@/screens/atividades/ListaTags';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { listarAtividadesArquivadas } from '@/servidor/atividades/consultasAtividades';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  formatarDataComHoraOpcional,
  formatarInstanteParaExibicao,
} from '@/util/DataUtils';

type PropriedadesTelaArquivadas = {
  acesso: AcessoPainel;
  aviso: Aviso | null;
};

export default function TelaArquivadas({
  acesso,
  aviso,
}: PropriedadesTelaArquivadas) {
  const consulta = listarAtividadesArquivadas(
    obterBancoAplicacao(),
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
        titulo={textosArquivadas.titulo}
        descricao={
          acesso.permiteGestao
            ? textosArquivadas.descricao
            : textosArquivadas.descricaoLeitura
        }
      />
      <AvisoSucesso aviso={aviso} />
      {consulta.atividades.length === 0 ? (
        <Cartao>
          <p className="text-sm text-texto-suave">{textosArquivadas.vazio}</p>
        </Cartao>
      ) : (
        <>
          <p className="text-xs text-texto-suave">
            {textosArquivadas.descreverQuantidade(consulta.atividades.length)}
          </p>
          <ul className="flex flex-col gap-3">
            {consulta.atividades.map((atividade) => (
              <li key={atividade.id}>
                <Cartao className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={montarRotaAtividade(
                          atividade.id,
                          acesso.prefixoRotas,
                        )}
                        className="font-medium break-words hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
                      >
                        {atividade.titulo}
                      </Link>
                      <IndicadorPrioridade prioridade={atividade.prioridade} />
                    </div>
                    <p className="text-xs text-texto-suave">
                      {textosArquivadas.rotuloStatus}: {atividade.statusNome} ·{' '}
                      {textosAtividades.descreverSolicitante(
                        atividade.solicitante,
                      )}
                    </p>
                    {atividade.prazoData && (
                      <p className="text-xs text-texto-suave">
                        {textosAtividades.descreverPrazo(
                          formatarDataComHoraOpcional(
                            atividade.prazoData,
                            atividade.prazoHora,
                          ),
                        )}
                      </p>
                    )}
                    <p className="text-xs text-texto-suave">
                      {textosArquivadas.descreverArquivamento(
                        formatarInstanteParaExibicao(
                          atividade.arquivadaEm,
                          consulta.fusoHorario,
                        ),
                      )}
                    </p>
                    <ListaTags tags={atividade.tags} />
                  </div>
                  {acesso.permiteGestao && (
                    <div className="shrink-0">
                      <FormularioArquivamento
                        atividadeId={atividade.id}
                        versao={atividade.versao}
                        arquivada
                        credencial={acesso.tokenCompartilhamento}
                        retorno={RETORNOS_RESTAURACAO.ARQUIVADAS}
                      />
                    </div>
                  )}
                </Cartao>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
