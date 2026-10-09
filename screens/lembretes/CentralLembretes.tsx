'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type KeyboardEvent,
} from 'react';
import Botao from '@/components/ui/Botao';
import Icone from '@/components/ui/Icone';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { LEMBRETES } from '@/config/constantes';
import { ROTAS } from '@/config/rotas';
import FormularioLembreteAvulso from '@/screens/lembretes/FormularioLembreteAvulso';
import {
  avaliarNotificacoesNavegador,
  exibirNotificacaoNavegador,
  filtrarNaoExibidas,
  lerAmbienteNotificacoes,
  obterArmazenamentoLocal,
  registrarChaveExibida,
  solicitarPermissaoNotificacoes,
  type SituacaoNotificacoesNavegador,
} from '@/screens/lembretes/notificacoesNavegador';
import { textosLembretes as textos } from '@/screens/lembretes/textosLembretes';
import {
  dispensarLembreteAvulsoNotificacao,
  dispensarLembreteNotificacao,
  sincronizarLembretesNavegador,
} from '@/servidor/web/acoes/acoesLembretes';
import type { ResultadoAcao } from '@/types/acoes';
import type {
  LembreteProximoExibido,
  NotificacaoLembreteExibida,
} from '@/types/lembretes';
import { combinarClasses } from '@/util/ClassesUtils';

const MILISSEGUNDOS_POR_SEGUNDO = 1000;
const INTERVALO_SINCRONIZACAO_MS =
  LEMBRETES.INTERVALO_SINCRONIZACAO_SEGUNDOS * MILISSEGUNDOS_POR_SEGUNDO;
const TECLA_ESCAPE = 'Escape';
const SITUACAO_NO_SERVIDOR: SituacaoNotificacoesNavegador = 'indisponivel';
// "aaaa-mm-dd" na data local do navegador (sueco usa o formato ISO).
const LOCALIDADE_DATA_ISO = 'sv-SE';
const ANCORA_LEMBRETE = '#lembrete-';

type Aba = 'avisos' | 'proximos';

function obterJanela(): (Window & typeof globalThis) | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

// A permissão não tem evento de mudança confiável em todos os navegadores; a
// leitura é refeita a cada renderização, inclusive logo após o pedido.
function assinarSemEventos(): () => void {
  return () => undefined;
}

function lerSituacaoNavegador(): SituacaoNotificacoesNavegador {
  return avaliarNotificacoesNavegador(lerAmbienteNotificacoes(obterJanela()));
}

function lerSituacaoNoServidor(): SituacaoNotificacoesNavegador {
  return SITUACAO_NO_SERVIDOR;
}

// Atividade abre o detalhe; lembrete avulso abre a página de lembretes.
function montarDestino(
  lembrete: Pick<LembreteProximoExibido, 'rotaAtividade' | 'lembreteAvulsoId'>,
): string {
  return (
    lembrete.rotaAtividade ??
    `${ROTAS.LEMBRETES}${ANCORA_LEMBRETE}${lembrete.lembreteAvulsoId}`
  );
}

function dispensarNoServidor(
  notificacao: NotificacaoLembreteExibida,
): Promise<ResultadoAcao> {
  return notificacao.origem === 'avulso'
    ? dispensarLembreteAvulsoNotificacao({
        lembreteId: notificacao.lembreteAvulsoId,
        lembreteEm: notificacao.lembreteEm,
      })
    : dispensarLembreteNotificacao({
        atividadeId: notificacao.atividadeId,
        lembreteEm: notificacao.lembreteEm,
      });
}

function SeloOrigem({ origem }: Pick<LembreteProximoExibido, 'origem'>) {
  return (
    <span
      className={combinarClasses(
        'rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
        origem === 'avulso'
          ? 'bg-primaria-suave text-primaria-escura'
          : 'bg-fundo text-texto-suave',
      )}
    >
      {textos.origens[origem]}
    </span>
  );
}

type PropriedadesItemNotificacao = {
  notificacao: NotificacaoLembreteExibida;
  aoDispensar: (notificacao: NotificacaoLembreteExibida) => void;
  dispensando: boolean;
};

function ItemNotificacao({
  notificacao,
  aoDispensar,
  dispensando,
}: PropriedadesItemNotificacao) {
  return (
    <li className="flex items-start gap-3 p-3">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-aviso-fundo text-aviso"
      >
        <Icone nome="sino" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={montarDestino(notificacao)}
          className="text-sm font-medium break-words hover:text-primaria hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
        >
          {notificacao.titulo}
        </Link>
        {notificacao.observacao && (
          <p className="text-xs break-words text-texto-suave">
            {notificacao.observacao}
          </p>
        )}
        <span className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
          <SeloOrigem origem={notificacao.origem} />
          {textos.marcadoPara(notificacao.horarioExibido)}
          {notificacao.atrasado && (
            <span className="rounded-full bg-aviso-fundo px-2 py-0.5 font-medium text-aviso">
              {textos.atrasado}
            </span>
          )}
        </span>
      </div>
      <Botao
        variante="secundario"
        className="min-h-9 w-auto px-3 text-xs"
        onClick={() => aoDispensar(notificacao)}
        disabled={dispensando}
        aria-label={textos.descreverDispensa(notificacao.titulo)}
      >
        {textos.dispensar}
      </Botao>
    </li>
  );
}

function ItemProximo({ lembrete }: { lembrete: LembreteProximoExibido }) {
  return (
    <li className="flex items-start gap-3 p-3">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primaria-suave text-primaria-escura"
      >
        <Icone nome="relogio" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          href={montarDestino(lembrete)}
          className="text-sm font-medium break-words hover:text-primaria hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
        >
          {lembrete.titulo}
        </Link>
        <span className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
          <SeloOrigem origem={lembrete.origem} />
          {lembrete.horarioExibido}
        </span>
      </div>
    </li>
  );
}

// Só o proprietário recebe a central. Os avisos ficam no servidor (SQLite):
// recarregar a página mantém a lista, e o disparo de cada lembrete acontece
// uma única vez, na sincronização que o encontra pendente e vencido. Só
// essa sincronização gera notificação do sistema, e as chaves já exibidas
// ficam registradas neste navegador para não repetir o aviso.
export default function CentralLembretes() {
  const router = useRouter();
  const [notificacoes, setNotificacoes] = useState<
    NotificacaoLembreteExibida[]
  >([]);
  const [proximos, setProximos] = useState<LembreteProximoExibido[]>([]);
  const [aberta, setAberta] = useState(false);
  const [aba, setAba] = useState<Aba>('avisos');
  const [criando, setCriando] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const [falhaSincronizacao, setFalhaSincronizacao] = useState(false);
  const [falhaDispensa, setFalhaDispensa] = useState(false);
  const [solicitandoPermissao, setSolicitandoPermissao] = useState(false);
  const [dispensando, iniciarDispensa] = useTransition();
  const situacaoNavegador = useSyncExternalStore(
    assinarSemEventos,
    lerSituacaoNavegador,
    lerSituacaoNoServidor,
  );
  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const sincronizarRef = useRef<() => Promise<void>>(async () => undefined);
  const idPainel = useId();
  const idTitulo = useId();
  const idAbaAvisos = useId();
  const idAbaProximos = useId();

  useEffect(() => {
    let montada = true;
    let emAndamento = false;

    function avisarNovas(novas: readonly NotificacaoLembreteExibida[]): void {
      if (novas.length === 0) {
        return;
      }
      const janela = obterJanela();
      const armazenamento = obterArmazenamentoLocal(janela);
      const ambiente = lerAmbienteNotificacoes(janela);
      for (const notificacao of filtrarNaoExibidas(armazenamento, novas)) {
        exibirNotificacaoNavegador(
          ambiente,
          {
            chave: notificacao.chave,
            titulo: textos.tituloNotificacao(notificacao.titulo),
            corpo: textos.corpoNotificacao(
              notificacao.horarioExibido,
              notificacao.atrasado,
            ),
          },
          () => {
            janela?.focus();
            router.push(montarDestino(notificacao));
          },
        );
        registrarChaveExibida(armazenamento, notificacao.chave);
      }
      setAnuncio(textos.anunciarNovos(novas.map((item) => item.titulo)));
      setAba('avisos');
      setAberta(true);
      router.refresh();
    }

    async function sincronizar(): Promise<void> {
      if (emAndamento) {
        return;
      }
      emAndamento = true;
      try {
        const resultado = await sincronizarLembretesNavegador();
        if (!montada) {
          return;
        }
        setNotificacoes(resultado.aDispensar);
        setProximos(resultado.proximos);
        setFalhaSincronizacao(false);
        avisarNovas(resultado.novas);
      } catch {
        if (montada) {
          setFalhaSincronizacao(true);
        }
      } finally {
        emAndamento = false;
      }
    }

    function sincronizarAoVoltar(): void {
      if (document.visibilityState === 'visible') {
        void sincronizar();
      }
    }

    sincronizarRef.current = sincronizar;
    void sincronizar();
    const intervalo = window.setInterval(() => {
      void sincronizar();
    }, INTERVALO_SINCRONIZACAO_MS);
    document.addEventListener('visibilitychange', sincronizarAoVoltar);
    return () => {
      montada = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', sincronizarAoVoltar);
    };
  }, [router]);

  useEffect(() => {
    if (!aberta) {
      return;
    }
    function fecharAoClicarFora(evento: PointerEvent): void {
      if (!raizRef.current?.contains(evento.target as Node)) {
        setAberta(false);
      }
    }
    document.addEventListener('pointerdown', fecharAoClicarFora);
    return () =>
      document.removeEventListener('pointerdown', fecharAoClicarFora);
  }, [aberta]);

  const concluirCriacao = useCallback(() => {
    setCriando(false);
    setAba('proximos');
    void sincronizarRef.current();
  }, []);

  function dispensar(notificacao: NotificacaoLembreteExibida): void {
    setFalhaDispensa(false);
    iniciarDispensa(async () => {
      try {
        const resultado = await dispensarNoServidor(notificacao);
        if (!resultado.ok) {
          setFalhaDispensa(true);
          return;
        }
        setNotificacoes((atuais) =>
          atuais.filter((item) => item.chave !== notificacao.chave),
        );
      } catch {
        setFalhaDispensa(true);
      }
    });
  }

  async function ativarNotificacoes(): Promise<void> {
    setSolicitandoPermissao(true);
    await solicitarPermissaoNotificacoes(
      lerAmbienteNotificacoes(obterJanela()),
    );
    setSolicitandoPermissao(false);
  }

  function fecharComTeclado(evento: KeyboardEvent<HTMLDivElement>): void {
    if (evento.key === TECLA_ESCAPE && aberta) {
      evento.stopPropagation();
      setAberta(false);
      botaoRef.current?.focus();
    }
  }

  const quantidade = notificacoes.length;
  const dataMinima = new Date().toLocaleDateString(LOCALIDADE_DATA_ISO);
  return (
    <div ref={raizRef} className="relative" onKeyDown={fecharComTeclado}>
      <button
        ref={botaoRef}
        type="button"
        aria-expanded={aberta}
        aria-controls={idPainel}
        aria-label={textos.descreverBotaoCentral(quantidade)}
        title={textos.botaoCentral}
        onClick={() => setAberta((valor) => !valor)}
        className="relative inline-flex size-10 items-center justify-center rounded-full border border-borda bg-superficie text-texto shadow-cartao transition-colors hover:bg-fundo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
      >
        <Icone nome="sino" className="size-5" />
        {quantidade > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-erro px-1 text-[0.6875rem] font-semibold text-white ring-2 ring-superficie"
          >
            {quantidade}
          </span>
        )}
      </button>
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      <div
        id={idPainel}
        role="region"
        aria-labelledby={idTitulo}
        hidden={!aberta}
        className="absolute right-0 z-50 mt-2 flex w-[min(26rem,calc(100vw-2rem))] origin-top-right animate-surgir flex-col gap-3 rounded-2xl border border-borda bg-superficie p-3 text-texto shadow-flutuante"
      >
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 id={idTitulo} className="text-base font-semibold">
            {textos.tituloCentral}
          </h2>
          <button
            type="button"
            onClick={() => setCriando((valor) => !valor)}
            aria-expanded={criando}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-primaria hover:bg-primaria-suave focus-visible:outline-2 focus-visible:outline-primaria"
          >
            <Icone nome={criando ? 'fechar' : 'mais'} />
            {criando ? textos.fecharNovoLembrete : textos.novoLembrete}
          </button>
        </div>
        {criando && (
          <div className="rounded-xl border border-borda bg-fundo/60 p-3">
            <FormularioLembreteAvulso
              compacto
              dataMinima={dataMinima}
              aoSalvar={concluirCriacao}
            />
          </div>
        )}
        <div
          role="tablist"
          aria-label={textos.rotuloAbas}
          className="grid grid-cols-2 rounded-xl bg-fundo p-1"
        >
          {(
            [
              ['avisos', idAbaAvisos, textos.abaAvisos, quantidade],
              ['proximos', idAbaProximos, textos.abaProximos, proximos.length],
            ] as const
          ).map(([valor, id, rotulo, total]) => (
            <button
              key={valor}
              id={id}
              type="button"
              role="tab"
              aria-selected={aba === valor}
              onClick={() => setAba(valor)}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium text-texto-suave aria-selected:bg-superficie aria-selected:text-texto aria-selected:shadow-cartao focus-visible:outline-2 focus-visible:outline-primaria"
            >
              {rotulo}
              <span className="rounded-full bg-texto/10 px-1.5 text-xs tabular-nums">
                {total}
              </span>
            </button>
          ))}
        </div>
        {falhaSincronizacao && (
          <MensagemAlerta tipo="aviso">
            {textos.falhaSincronizacao}
          </MensagemAlerta>
        )}
        {falhaDispensa && (
          <MensagemAlerta tipo="erro">{textos.falhaDispensa}</MensagemAlerta>
        )}
        <div
          role="tabpanel"
          aria-labelledby={aba === 'avisos' ? idAbaAvisos : idAbaProximos}
        >
          {aba === 'avisos' ? (
            quantidade === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-texto-suave">
                {textos.nenhumAviso}
              </p>
            ) : (
              <ul className="flex max-h-[50vh] flex-col divide-y divide-borda overflow-y-auto rounded-xl border border-borda">
                {notificacoes.map((notificacao) => (
                  <ItemNotificacao
                    key={notificacao.chave}
                    notificacao={notificacao}
                    aoDispensar={dispensar}
                    dispensando={dispensando}
                  />
                ))}
              </ul>
            )
          ) : proximos.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-texto-suave">
              {textos.nenhumProximo}
            </p>
          ) : (
            <ul className="flex max-h-[50vh] flex-col divide-y divide-borda overflow-y-auto rounded-xl border border-borda">
              {proximos.map((lembrete) => (
                <ItemProximo key={lembrete.chave} lembrete={lembrete} />
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-borda px-1 pt-3">
          <Link
            href={ROTAS.LEMBRETES}
            onClick={() => setAberta(false)}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primaria hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
          >
            {textos.verTodos}
          </Link>
          <p className="text-xs text-texto-suave">
            {textos.situacoesNavegador[situacaoNavegador]}
          </p>
          {situacaoNavegador === 'nao-solicitada' && (
            <div>
              <Botao
                variante="secundario"
                onClick={() => void ativarNotificacoes()}
                disabled={solicitandoPermissao}
              >
                {solicitandoPermissao
                  ? textos.ativandoNotificacoes
                  : textos.ativarNotificacoes}
              </Botao>
            </div>
          )}
          <p className="text-xs text-texto-suave">{textos.limitacao}</p>
        </div>
      </div>
    </div>
  );
}
