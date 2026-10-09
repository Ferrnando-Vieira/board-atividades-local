import type { ReactNode } from 'react';
import Cartao from '@/components/ui/Cartao';
import Icone, { type NomeIcone } from '@/components/ui/Icone';
import { montarRotaImagemFundo } from '@/config/rotas';
import FormularioFundo from '@/screens/aparencia/FormularioFundo';
import FormularioGradiente from '@/screens/aparencia/FormularioGradiente';
import FormularioImagemFundo from '@/screens/aparencia/FormularioImagemFundo';
import FormularioPrioridades from '@/screens/aparencia/FormularioPrioridades';
import FormularioRestauracaoAparencia from '@/screens/aparencia/FormularioRestauracaoAparencia';
import FormularioSuperficies from '@/screens/aparencia/FormularioSuperficies';
import { textosAparencia as textos } from '@/screens/aparencia/textosAparencia';
import {
  consultarAparenciaBoard,
  obterAmostrasFundo,
} from '@/servidor/board/aparenciaBoard';
import {
  consultarConfiguracaoFundo,
  montarEstiloFundoConfigurado,
  possuiAparenciaPropria,
} from '@/servidor/board/fundoBoard';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';

type SecaoAparencia = keyof typeof textos.secoes;

const ICONES_SECOES: Record<SecaoAparencia, NomeIcone> = {
  fundo: 'paleta',
  gradiente: 'paleta',
  imagem: 'arquivo',
  colunas: 'colunas',
  prioridades: 'filtro',
};

const ORDEM_SECOES: readonly SecaoAparencia[] = [
  'colunas',
  'fundo',
  'gradiente',
  'imagem',
  'prioridades',
];

function SecaoCartao({
  secao,
  titulo,
  descricao,
  children,
}: {
  secao: SecaoAparencia;
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <div id={secao} className="scroll-mt-28">
      <Cartao className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icone nome={ICONES_SECOES[secao]} className="text-primaria" />
            {titulo}
          </h2>
          {descricao && <p className="text-sm text-texto-suave">{descricao}</p>}
        </header>
        {children}
      </Cartao>
    </div>
  );
}

type PropriedadesTelaAparencia = {
  acesso: AcessoPainel;
};

// O proprietário edita a aparência do board; um link nomeado, a própria (a
// página confere qual). As rotas de imagem usam o prefixo do acesso.
export default function TelaAparencia({ acesso }: PropriedadesTelaAparencia) {
  const banco = obterBancoAplicacao();
  const escopo = acesso.escopoAparencia;
  const credencial = acesso.tokenCompartilhamento;
  const configuracao = consultarConfiguracaoFundo(banco, escopo);
  const aparencia = consultarAparenciaBoard(banco, escopo);
  const amostrasFundo = obterAmostrasFundo(configuracao);
  const estiloFundo = montarEstiloFundoConfigurado(
    configuracao,
    acesso.prefixoRotas,
  );
  const rotaImagemAtual =
    configuracao.tipo === 'imagem' && configuracao.imagem
      ? montarRotaImagemFundo(configuracao.imagem.hash, acesso.prefixoRotas)
      : null;
  const aparenciaPropria =
    escopo.tipo === 'link' && possuiAparenciaPropria(banco, escopo.linkId);
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[13rem_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Cartao className="flex flex-col gap-3 p-3 sm:p-3">
          <header className="px-2 pt-1">
            <h1 className="text-xl font-semibold">{textos.titulo}</h1>
          </header>
          <nav aria-label={textos.rotuloSecoes}>
            <ul className="rolagem-fina flex gap-1 overflow-x-auto lg:flex-col">
              {ORDEM_SECOES.map((secao) => (
                <li key={secao}>
                  <a
                    href={`#${secao}`}
                    className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap text-texto-suave hover:bg-texto/5 hover:text-texto focus-visible:outline-2 focus-visible:outline-primaria"
                  >
                    <Icone nome={ICONES_SECOES[secao]} />
                    {textos.secoes[secao]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Cartao>
      </aside>
      <div className="flex min-w-0 flex-col gap-6">
        {escopo.tipo === 'link' ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-borda/80 bg-superficie/90 px-4 py-3 text-sm text-texto-suave shadow-cartao sm:flex-row sm:items-center sm:justify-between">
            <p>
              {textos.descricaoLink}{' '}
              {aparenciaPropria
                ? textos.descricaoLinkPropria
                : textos.descricaoLinkSeguindoBoard}
            </p>
            {aparenciaPropria && (
              <FormularioRestauracaoAparencia credencial={credencial} />
            )}
          </div>
        ) : (
          <p className="rounded-2xl border border-borda/80 bg-superficie/90 px-4 py-3 text-sm text-texto-suave shadow-cartao">
            {textos.descricao}
          </p>
        )}
        <SecaoCartao
          secao="colunas"
          titulo={textos.tituloSuperficies}
          descricao={textos.descricaoSuperficies}
        >
          <FormularioSuperficies
            credencial={credencial}
            superficiesAtuais={aparencia.superficies}
            amostrasFundo={amostrasFundo}
            estiloFundo={estiloFundo}
          />
        </SecaoCartao>
        <SecaoCartao secao="fundo" titulo={textos.tituloPredefinidos}>
          <FormularioFundo
            credencial={credencial}
            fundoAtual={
              configuracao.tipo === 'predefinido'
                ? configuracao.chavePredefinida
                : null
            }
          />
        </SecaoCartao>
        <SecaoCartao
          secao="gradiente"
          titulo={textos.tituloGradiente}
          descricao={textos.descricaoGradiente}
        >
          <FormularioGradiente
            credencial={credencial}
            gradienteAtual={configuracao.gradiente}
            emUso={configuracao.tipo === 'gradiente'}
            superficies={aparencia.superficies}
          />
        </SecaoCartao>
        <SecaoCartao secao="imagem" titulo={textos.tituloImagem}>
          <FormularioImagemFundo
            credencial={credencial}
            rotaImagemAtual={rotaImagemAtual}
            imagemSemCor={
              configuracao.tipo === 'imagem' &&
              configuracao.imagem?.corMedia === null
            }
          />
        </SecaoCartao>
        <SecaoCartao
          secao="prioridades"
          titulo={textos.tituloPrioridades}
          descricao={textos.descricaoPrioridades}
        >
          <FormularioPrioridades
            credencial={credencial}
            coresAtuais={aparencia.prioridades}
          />
        </SecaoCartao>
      </div>
    </div>
  );
}
