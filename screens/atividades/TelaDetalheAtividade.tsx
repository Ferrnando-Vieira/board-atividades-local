import { notFound } from 'next/navigation';
import { useId, type ReactNode } from 'react';
import Cartao from '@/components/ui/Cartao';
import LinkBotao from '@/components/ui/LinkBotao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { aplicarPrefixo, ROTAS, type Aviso } from '@/config/rotas';
import AvisoSucesso from '@/screens/aplicacao/AvisoSucesso';
import DescricaoFormatada from '@/screens/atividades/DescricaoFormatada';
import EdicaoAtividade, {
  BotaoEditarAtividade,
} from '@/screens/atividades/EdicaoAtividade';
import FormularioArquivamento from '@/screens/atividades/FormularioArquivamento';
import IndicadorPrazo from '@/screens/atividades/IndicadorPrazo';
import IndicadorPrioridade from '@/screens/atividades/IndicadorPrioridade';
import ListaTags from '@/screens/atividades/ListaTags';
import SecaoAnexos from '@/screens/atividades/SecaoAnexos';
import SecaoHistorico from '@/screens/atividades/SecaoHistorico';
import SecaoLembrete from '@/screens/atividades/SecaoLembrete';
import { descreverSituacaoLembrete } from '@/screens/atividades/descricaoLembrete';
import { montarImagensDescricao } from '@/screens/atividades/imagensDescricao';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { montarValoresEdicaoAtividade } from '@/screens/atividades/valoresFormularioAtividade';
import {
  consultarDetalheAtividade,
  consultarOpcoesFormularioAtividade,
} from '@/servidor/atividades/consultasAtividades';
import { consultarHistoricoAtividade } from '@/servidor/historico/consultasHistorico';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  formatarDataComHoraOpcional,
  formatarInstanteParaExibicao,
} from '@/util/DataUtils';
import { listarIdsAnexosReferenciados } from '@/util/DescricaoUtils';

type PropriedadesItemDetalhe = {
  rotulo: string;
  children: ReactNode;
};

function ItemDetalhe({ rotulo, children }: PropriedadesItemDetalhe) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold tracking-wide text-texto-suave uppercase">
        {rotulo}
      </dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

type PropriedadesTelaDetalheAtividade = {
  acesso: AcessoPainel;
  atividadeId: number;
  aviso: Aviso | null;
  // "modal": aberta por cima do quadro; o próprio diálogo dá a moldura e o
  // fechamento, então o cartão e o link de voltar ficam de fora.
  variante?: 'pagina' | 'modal';
};

export function montarIdTituloAtividade(atividadeId: number): string {
  return `titulo-atividade-${atividadeId}`;
}

export default function TelaDetalheAtividade({
  acesso,
  atividadeId,
  aviso,
  variante = 'pagina',
}: PropriedadesTelaDetalheAtividade) {
  const idDescricao = useId();
  const agora = new Date();
  const banco = obterBancoAplicacao();
  const consulta = consultarDetalheAtividade(
    banco,
    atividadeId,
    agora,
    acesso.restricao,
  );
  if (!consulta) {
    notFound();
  }
  const { atividade, fusoHorario, momentoLocal } = consulta;
  const arquivada = atividade.arquivadaEm !== null;
  // Lembretes são avisos pessoais do administrador: links (completo ou
  // restrito) não veem nem a situação do lembrete.
  const lembrete = acesso.permiteAdministracao
    ? descreverSituacaoLembrete({ ...atividade, arquivada }, agora, fusoHorario)
    : null;
  const rotaVoltar =
    arquivada && acesso.exibeArquivadas ? ROTAS.ARQUIVADAS : ROTAS.INICIO;
  const emModal = variante === 'modal';
  const idTitulo = montarIdTituloAtividade(atividade.id);
  // Editar acontece aqui mesmo (no modal ou na página), sem outra tela.
  const opcoesEdicao =
    acesso.permiteGestao && !arquivada
      ? consultarOpcoesFormularioAtividade(banco)
      : null;
  // Imagens da descrição só saem dos anexos desta atividade, pela rota do
  // próprio acesso (que confere o escopo de novo a cada imagem).
  const imagensDescricao = montarImagensDescricao(
    atividade.anexos,
    acesso.prefixoRotas,
  );
  const historico = consultarHistoricoAtividade(banco, atividade.id);
  const conteudo = (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 id={idTitulo} className="text-xl font-semibold break-words">
            {atividade.titulo}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <IndicadorPrioridade prioridade={atividade.prioridade} detalhado />
            <span className="rounded-md border border-borda px-1.5 py-0.5 text-xs">
              {atividade.status.nome}
            </span>
          </div>
        </div>
        {acesso.permiteGestao && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
            {opcoesEdicao && <BotaoEditarAtividade />}
            <FormularioArquivamento
              atividadeId={atividade.id}
              versao={atividade.versao}
              arquivada={arquivada}
              credencial={acesso.tokenCompartilhamento}
            />
          </div>
        )}
      </header>
      {arquivada && (
        <MensagemAlerta tipo="aviso">
          {textosAtividades.atividadeArquivada}
        </MensagemAlerta>
      )}
      <section aria-labelledby={idDescricao} className="flex flex-col gap-1">
        <h2 id={idDescricao} className="text-sm font-semibold">
          {textosAtividades.rotuloDescricao}
        </h2>
        {atividade.descricao ? (
          <DescricaoFormatada
            texto={atividade.descricao}
            imagens={imagensDescricao}
          />
        ) : (
          <p className="text-sm text-texto-suave">
            {textosAtividades.semDescricao}
          </p>
        )}
      </section>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <ItemDetalhe rotulo={textosAtividades.rotuloSolicitante}>
          {atividade.solicitante}
        </ItemDetalhe>
        <ItemDetalhe rotulo={textosAtividades.rotuloPrazo}>
          {atividade.prazoData ? (
            <IndicadorPrazo
              prazoData={atividade.prazoData}
              prazoHora={atividade.prazoHora}
              momentoLocal={momentoLocal}
              concluida={atividade.status.finalizaAtividade}
              exibirRotulo={false}
            />
          ) : (
            textosAtividades.semPrazo
          )}
        </ItemDetalhe>
        <ItemDetalhe rotulo={textosAtividades.rotuloTags}>
          <ListaTags tags={atividade.tags} exibirVazio />
        </ItemDetalhe>
        {atividade.concluidaEmData && (
          <ItemDetalhe rotulo={textosAtividades.rotuloConcluidaEm}>
            {formatarDataComHoraOpcional(
              atividade.concluidaEmData,
              atividade.concluidaEmHora,
            )}
          </ItemDetalhe>
        )}
        {lembrete && (
          <ItemDetalhe rotulo={textosAtividades.rotuloLembrete}>
            <span className="flex flex-col gap-1">
              <span>{lembrete.resumo}</span>
              {lembrete.detalhe && (
                <span className="text-xs text-texto-suave">
                  {lembrete.detalhe}
                </span>
              )}
            </span>
          </ItemDetalhe>
        )}
        {atividade.arquivadaEm && (
          <ItemDetalhe rotulo={textosAtividades.rotuloArquivadaEm}>
            {formatarInstanteParaExibicao(atividade.arquivadaEm, fusoHorario)}
          </ItemDetalhe>
        )}
        <ItemDetalhe rotulo={textosAtividades.rotuloCriadaEm}>
          {formatarInstanteParaExibicao(atividade.criadoEm, fusoHorario)}
        </ItemDetalhe>
        <ItemDetalhe rotulo={textosAtividades.rotuloAtualizadaEm}>
          {formatarInstanteParaExibicao(atividade.atualizadoEm, fusoHorario)}
        </ItemDetalhe>
      </dl>
      {acesso.permiteAdministracao && !arquivada && (
        <SecaoLembrete
          atividade={atividade}
          fusoHorario={fusoHorario}
          momentoLocal={momentoLocal}
          agora={agora}
        />
      )}
      <SecaoAnexos
        anexos={atividade.anexos}
        atividadeId={atividade.id}
        arquivada={arquivada}
        fusoHorario={fusoHorario}
        acesso={acesso}
        idsNaDescricao={listarIdsAnexosReferenciados(atividade.descricao ?? '')}
      />
      <SecaoHistorico
        historico={historico}
        fusoHorario={fusoHorario}
        exibirAutor={acesso.permiteAdministracao}
      />
      {!emModal && (
        <div>
          <LinkBotao href={aplicarPrefixo(acesso.prefixoRotas, rotaVoltar)}>
            {rotaVoltar === ROTAS.ARQUIVADAS
              ? textosAtividades.voltarArquivadas
              : textosAtividades.voltarQuadro}
          </LinkBotao>
        </div>
      )}
    </>
  );
  const conteudoEditavel = opcoesEdicao ? (
    <EdicaoAtividade
      idTitulo={idTitulo}
      formulario={{
        valoresIniciais: montarValoresEdicaoAtividade(atividade),
        opcoes: opcoesEdicao,
        credencial: acesso.tokenCompartilhamento,
        identificacao: { atividadeId: atividade.id, versao: atividade.versao },
        imagensDescricao,
      }}
    >
      {conteudo}
    </EdicaoAtividade>
  ) : (
    conteudo
  );
  if (emModal) {
    return (
      <div className="flex flex-col gap-5">
        <AvisoSucesso aviso={aviso} />
        {conteudoEditavel}
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <AvisoSucesso aviso={aviso} />
      <Cartao className="flex flex-col gap-5">{conteudoEditavel}</Cartao>
    </div>
  );
}
