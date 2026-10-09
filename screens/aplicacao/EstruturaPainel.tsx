import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import Icone, { type NomeIcone } from '@/components/ui/Icone';
import LogoBoard from '@/components/ui/LogoBoard';
import MenuSuspenso from '@/components/ui/MenuSuspenso';
import { ROTAS } from '@/config/rotas';
import {
  SECOES_MENU_CONTA,
  SECOES_PAINEL,
  textosAplicacao,
  textosSecoes,
  type SecaoPainel,
} from '@/screens/aplicacao/textosAplicacao';
import CentralLembretes from '@/screens/lembretes/CentralLembretes';
import PresencaBoard from '@/screens/presenca/PresencaBoard';
import AtualizacaoTempoReal from '@/screens/tempoReal/AtualizacaoTempoReal';
import { montarAparenciaPainel } from '@/servidor/board/aparenciaBoard';
import { sair } from '@/servidor/web/acoes/acoesAutenticacao';
import {
  extrairContextoNavegacao,
  montarRotaDoAcesso,
  type AcessoPainel,
} from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { combinarClasses } from '@/util/ClassesUtils';
import { extrairIniciais } from '@/util/NormalizacaoUtils';

const ROTAS_SECOES: Record<SecaoPainel, string> = {
  quadro: ROTAS.INICIO,
  busca: ROTAS.BUSCA,
  arquivadas: ROTAS.ARQUIVADAS,
  status: ROTAS.STATUS,
  tags: ROTAS.TAGS,
  lembretes: ROTAS.LEMBRETES,
  solicitantes: ROTAS.SOLICITANTES,
  integracoes: ROTAS.INTEGRACOES,
  aparencia: ROTAS.APARENCIA,
};

const ICONES_SECOES: Record<SecaoPainel, NomeIcone> = {
  quadro: 'quadro',
  busca: 'busca',
  arquivadas: 'arquivo',
  status: 'colunas',
  tags: 'tag',
  lembretes: 'sino',
  solicitantes: 'pessoas',
  integracoes: 'plugue',
  aparencia: 'paleta',
};

// A navegação só mostra o que o acesso pode abrir; a página também confere
// no servidor, então esconder o link é conveniência, não proteção.
const SECAO_DISPONIVEL: Record<SecaoPainel, (acesso: AcessoPainel) => boolean> =
  {
    quadro: () => true,
    busca: () => true,
    arquivadas: (acesso) => acesso.exibeArquivadas,
    status: (acesso) => acesso.permiteGestao,
    tags: (acesso) => acesso.permiteGestao,
    lembretes: (acesso) => acesso.permiteAdministracao,
    solicitantes: (acesso) => acesso.permiteAdministracao,
    integracoes: (acesso) => acesso.permiteAdministracao,
    aparencia: (acesso) => acesso.permiteAparencia,
  };

const SECOES_DA_CONTA: readonly SecaoPainel[] = SECOES_MENU_CONTA;

export type LayoutPainel = 'padrao' | 'tela-cheia';

type PropriedadesEstruturaPainel = {
  acesso: AcessoPainel;
  secaoAtiva?: SecaoPainel;
  // "tela-cheia" (só o quadro): no desktop a página não rola; as colunas
  // rolam por dentro e a faixa horizontal fica sempre à vista.
  layout?: LayoutPainel;
  children: ReactNode;
};

type PropriedadesNavegacao = {
  acesso: AcessoPainel;
  secoes: readonly SecaoPainel[];
  secaoAtiva?: SecaoPainel;
  className?: string;
};

function NavegacaoPrincipal({
  acesso,
  secoes,
  secaoAtiva,
  className,
}: PropriedadesNavegacao) {
  return (
    <nav aria-label={textosAplicacao.rotuloNavegacao} className={className}>
      <ul className="flex gap-1">
        {secoes.map((secao) => {
          const ativa = secao === secaoAtiva;
          return (
            <li key={secao}>
              <Link
                href={montarRotaDoAcesso(acesso, ROTAS_SECOES[secao])}
                aria-current={ativa ? 'page' : undefined}
                className={combinarClasses(
                  'inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-primaria',
                  ativa
                    ? 'bg-primaria-suave font-semibold text-primaria-escura'
                    : 'text-texto-suave hover:bg-texto/5 hover:text-texto',
                )}
              >
                <Icone nome={ICONES_SECOES[secao]} />
                {textosSecoes[secao]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MenuConta({
  acesso,
  secaoAtiva,
}: {
  acesso: AcessoPainel;
  secaoAtiva?: SecaoPainel;
}) {
  const secoes = SECOES_DA_CONTA.filter((secao) =>
    SECAO_DISPONIVEL[secao](acesso),
  );
  return (
    <MenuSuspenso
      rotulo={textosAplicacao.rotuloMenuConta}
      tipo="menu"
      classesBotao="size-10 bg-primaria text-sm font-semibold text-white shadow-cartao hover:bg-primaria-escura"
      conteudoBotao={
        <span aria-hidden="true">{extrairIniciais(acesso.identificacao)}</span>
      }
    >
      <div className="flex items-center gap-3 border-b border-borda px-3 pt-2 pb-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primaria-suave text-sm font-semibold text-primaria-escura"
        >
          {extrairIniciais(acesso.identificacao)}
        </span>
        <p className="flex min-w-0 flex-col text-sm">
          <span className="text-xs text-texto-suave">
            {textosAplicacao.sessaoDe}
          </span>
          <span className="truncate font-semibold">{acesso.identificacao}</span>
        </p>
      </div>
      <ul className="flex flex-col py-1">
        {secoes.map((secao) => (
          <li key={secao}>
            <Link
              href={montarRotaDoAcesso(acesso, ROTAS_SECOES[secao])}
              aria-current={secao === secaoAtiva ? 'page' : undefined}
              className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-texto/5 focus-visible:outline-2 focus-visible:outline-primaria aria-[current=page]:font-semibold aria-[current=page]:text-primaria-escura"
            >
              <Icone nome={ICONES_SECOES[secao]} />
              {textosSecoes[secao]}
            </Link>
          </li>
        ))}
      </ul>
      <form action={sair} className="border-t border-borda pt-1">
        <button
          type="submit"
          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-erro hover:bg-erro-fundo focus-visible:outline-2 focus-visible:outline-primaria"
        >
          <Icone nome="sair" />
          {textosAplicacao.botaoSair}
        </button>
      </form>
    </MenuSuspenso>
  );
}

function SeloLink({ acesso }: { acesso: AcessoPainel }) {
  return (
    <p className="flex min-w-0 items-center gap-2 rounded-full border border-borda bg-superficie/80 py-1 pr-3 pl-2 text-xs text-texto-suave">
      <Icone nome="link" className="text-primaria" />
      <span className="max-w-40 truncate">
        <span className="sr-only">{textosAplicacao.acessoCompartilhado}: </span>
        {acesso.identificacao}
      </span>
      {acesso.modalidade && (
        <span className="rounded-full bg-primaria-suave px-2 py-0.5 font-medium whitespace-nowrap text-primaria-escura">
          {textosAplicacao.modalidades[acesso.modalidade]}
        </span>
      )}
    </p>
  );
}

export default function EstruturaPainel({
  acesso,
  secaoAtiva,
  layout = 'padrao',
  children,
}: PropriedadesEstruturaPainel) {
  const administrador = acesso.tipo === 'administrador';
  // Quem entra por link não tem o menu da conta: o que ele pode abrir dali
  // (a própria aparência) vai para a barra de navegação.
  const secoesNavegacao = SECOES_PAINEL.filter(
    (secao) =>
      (!administrador || !SECOES_DA_CONTA.includes(secao)) &&
      SECAO_DISPONIVEL[secao](acesso),
  );
  // Fundo, cores e transparências saem de valores conferidos no servidor
  // (nunca de CSS gravado) e valem para o proprietário e para os links. O
  // fundo fica numa camada fixa atrás do conteúdo: a imagem cobre a tela sem
  // se esticar com páginas longas.
  const aparencia = montarAparenciaPainel(
    obterBancoAplicacao(),
    acesso.prefixoRotas,
    acesso.escopoAparencia,
  );
  const telaCheia = layout === 'tela-cheia';
  return (
    <div
      className={combinarClasses(
        'relative isolate flex min-h-dvh flex-col',
        telaCheia && 'md:h-dvh md:min-h-0 md:overflow-hidden',
      )}
      style={aparencia.variaveis as CSSProperties}
    >
      {aparencia.estiloFundo && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10"
          style={aparencia.estiloFundo}
        />
      )}
      <header className="vidro sticky top-0 z-30 border-b border-borda/70 text-texto">
        <div className="flex h-16 w-full items-center gap-3 px-4 md:px-6">
          <Link
            href={montarRotaDoAcesso(acesso, ROTAS.INICIO)}
            aria-label={textosAplicacao.irParaInicio}
            className="flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-primaria"
          >
            <LogoBoard className="size-9 shrink-0 rounded-xl shadow-cartao" />
            <span className="hidden text-base font-semibold tracking-tight lg:inline">
              {textosAplicacao.titulo}
            </span>
          </Link>
          <NavegacaoPrincipal
            acesso={acesso}
            secoes={secoesNavegacao}
            secaoAtiva={secaoAtiva}
            className="rolagem-fina hidden min-w-0 flex-1 overflow-x-auto md:block"
          />
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <AtualizacaoTempoReal contexto={extrairContextoNavegacao(acesso)} />
            <PresencaBoard contexto={extrairContextoNavegacao(acesso)} />
            {administrador && <CentralLembretes />}
            {administrador ? (
              <MenuConta acesso={acesso} secaoAtiva={secaoAtiva} />
            ) : (
              <SeloLink acesso={acesso} />
            )}
          </div>
        </div>
        <NavegacaoPrincipal
          acesso={acesso}
          secoes={secoesNavegacao}
          secaoAtiva={secaoAtiva}
          className="rolagem-fina overflow-x-auto border-t border-borda/60 px-3 py-1.5 md:hidden"
        />
      </header>
      <main
        data-tom={aparencia.tomFundo}
        className={combinarClasses(
          'flex w-full flex-1 flex-col gap-4 p-4 md:px-6',
          telaCheia ? 'md:min-h-0 md:overflow-hidden md:py-4' : 'md:py-6',
        )}
      >
        {children}
      </main>
    </div>
  );
}
