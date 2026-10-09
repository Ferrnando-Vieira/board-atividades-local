'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from 'react';
import EstruturaCampo, {
  classesControle,
  descreverCampo,
} from '@/components/ui/EstruturaCampo';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';
import { combinarClasses } from '@/util/ClassesUtils';
import {
  alterarCampo,
  iniciarCamposDataHora,
  lerValorEnviado,
  lerValorExibido,
  limparCampos,
  soltarCampoVazio,
  sugerirMomentoLocal,
  usarSugestao,
  type CampoDataHora,
} from '@/util/SugestaoDataHoraUtils';

const textos = textosAplicacao.camposDataHora;

const MILISSEGUNDOS_POR_MINUTO = 60_000;
const VERIFICACOES_POR_MINUTO = 4;
// Teclas que só passam pelo campo (ou enviam o formulário) não contam como
// uso da sugestão.
const TECLAS_NEUTRAS = new Set([
  'Tab',
  'Shift',
  'Escape',
  'Enter',
  'Control',
  'Alt',
  'Meta',
]);

// O relógio entra pelo useSyncExternalStore: no servidor e na hidratação não
// há sugestão (o HTML não depende da hora de quem renderizou), e no
// navegador ela acompanha o minuto atual enquanto o campo fica aberto.
function assinarRelogio(aoMudar: () => void): () => void {
  const intervalo = window.setInterval(
    aoMudar,
    MILISSEGUNDOS_POR_MINUTO / VERIFICACOES_POR_MINUTO,
  );
  return () => window.clearInterval(intervalo);
}

function lerMinutoAtual(): number {
  return Math.floor(Date.now() / MILISSEGUNDOS_POR_MINUTO);
}

function lerMinutoNoServidor(): null {
  return null;
}

type PropriedadesCampoSugerido = {
  id: string;
  tipo: 'date' | 'time';
  rotulo: string;
  valor: string;
  emSugestao: boolean;
  idDicaSugestao: string;
  erros?: string[];
  obrigatorio: boolean;
  min?: string;
  referencia?: Ref<HTMLInputElement>;
  aoUsar: () => void;
  aoAlterar: (valor: string) => void;
  aoSair: () => void;
};

// O campo visível não tem `name`: quem vai no envio é o campo oculto do par,
// vazio enquanto o valor for só sugestão.
function CampoSugerido({
  id,
  tipo,
  rotulo,
  valor,
  emSugestao,
  idDicaSugestao,
  erros,
  obrigatorio,
  min,
  referencia,
  aoUsar,
  aoAlterar,
  aoSair,
}: PropriedadesCampoSugerido) {
  const descricao = descreverCampo(id, undefined, erros);
  const descritores =
    [descricao.idsDescricao, emSugestao ? idDicaSugestao : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <EstruturaCampo id={id} rotulo={rotulo} erros={erros}>
      <input
        ref={referencia}
        id={id}
        type={tipo}
        value={valor}
        min={min}
        required={obrigatorio}
        aria-invalid={descricao.possuiErro}
        aria-describedby={descritores}
        onPointerDown={aoUsar}
        onKeyDown={(evento) => {
          if (!TECLAS_NEUTRAS.has(evento.key)) {
            aoUsar();
          }
        }}
        onChange={(evento) => aoAlterar(evento.target.value)}
        onBlur={aoSair}
        className={classesControle(
          descricao.possuiErro,
          combinarClasses('min-h-11', emSugestao && 'text-texto-suave italic'),
        )}
      />
    </EstruturaCampo>
  );
}

type PropriedadesCamposDataHora = {
  idData: string;
  idHora: string;
  nomeData: string;
  nomeHora: string;
  rotuloData: string;
  rotuloHora: string;
  valorData: string;
  valorHora: string;
  errosData?: string[];
  errosHora?: string[];
  // Sugestão = agora + estas horas (0 sugere o momento atual).
  horasAFrente: number;
  // Fuso do board; sem ele, o do navegador.
  fusoHorario?: string;
  // Lembretes: data e hora exigidas, usadas e limpas juntas.
  obrigatorio?: boolean;
  dataMinima?: string;
  classesGrade?: string;
};

// Data e hora vazias mostram uma sugestão em cinza (hoje e um horário à
// frente). Ela só vira valor quando a pessoa clica ou digita no campo; sem
// isso, o envio vai vazio e nada é gravado por causa da sugestão.
export default function CamposDataHora({
  idData,
  idHora,
  nomeData,
  nomeHora,
  rotuloData,
  rotuloHora,
  valorData,
  valorHora,
  errosData,
  errosHora,
  horasAFrente,
  fusoHorario,
  obrigatorio = false,
  dataMinima,
  classesGrade = 'grid grid-cols-1 gap-4 sm:grid-cols-2',
}: PropriedadesCamposDataHora) {
  const [estado, setEstado] = useState(() =>
    iniciarCamposDataHora(valorData, valorHora),
  );
  const minuto = useSyncExternalStore(
    assinarRelogio,
    lerMinutoAtual,
    lerMinutoNoServidor,
  );
  const referenciaData = useRef<HTMLInputElement>(null);
  const idDicaSugestao = useId();
  const opcoes = { vinculados: obrigatorio };
  const sugestao =
    minuto === null
      ? null
      : sugerirMomentoLocal(
          new Date(minuto * MILISSEGUNDOS_POR_MINUTO),
          horasAFrente,
          fusoHorario ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
  const algumEmSugestao = !estado.data.emUso || !estado.hora.emUso;
  const algumEmUso = estado.data.emUso || estado.hora.emUso;

  // Num formulário com validação do navegador, enviar a sugestão intocada
  // é bloqueado com a explicação, em vez de chegar vazio ao servidor.
  useEffect(() => {
    referenciaData.current?.setCustomValidity(
      obrigatorio && !estado.data.emUso ? textos.escolhaObrigatoria : '',
    );
  }, [obrigatorio, estado.data.emUso]);

  function usar(campo: CampoDataHora): void {
    if (sugestao) {
      setEstado((atual) => usarSugestao(atual, campo, sugestao, opcoes));
    }
  }

  function alterar(campo: CampoDataHora, valor: string): void {
    setEstado((atual) =>
      alterarCampo(
        atual,
        campo,
        valor,
        sugestao ?? { data: '', hora: '' },
        opcoes,
      ),
    );
  }

  function sair(campo: CampoDataHora): void {
    setEstado((atual) => soltarCampoVazio(atual, campo, opcoes));
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="hidden"
        name={nomeData}
        value={lerValorEnviado(estado.data)}
      />
      <input
        type="hidden"
        name={nomeHora}
        value={lerValorEnviado(estado.hora)}
      />
      <div className={classesGrade}>
        <CampoSugerido
          id={idData}
          tipo="date"
          rotulo={rotuloData}
          valor={lerValorExibido(estado.data, sugestao?.data ?? null)}
          emSugestao={!estado.data.emUso}
          idDicaSugestao={idDicaSugestao}
          erros={errosData}
          obrigatorio={obrigatorio}
          min={dataMinima}
          referencia={referenciaData}
          aoUsar={() => usar('data')}
          aoAlterar={(valor) => alterar('data', valor)}
          aoSair={() => sair('data')}
        />
        <CampoSugerido
          id={idHora}
          tipo="time"
          rotulo={rotuloHora}
          valor={lerValorExibido(estado.hora, sugestao?.hora ?? null)}
          emSugestao={!estado.hora.emUso}
          idDicaSugestao={idDicaSugestao}
          erros={errosHora}
          obrigatorio={obrigatorio}
          aoUsar={() => usar('hora')}
          aoAlterar={(valor) => alterar('hora', valor)}
          aoSair={() => sair('hora')}
        />
      </div>
      {(algumEmSugestao || (!obrigatorio && algumEmUso)) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {algumEmSugestao && sugestao && (
            <p id={idDicaSugestao} className="text-xs text-texto-suave">
              {textos.dicaSugestao}
            </p>
          )}
          {!obrigatorio && algumEmUso && (
            <button
              type="button"
              onClick={() => setEstado(limparCampos())}
              className="ml-auto rounded-md px-1 text-xs font-medium text-primaria hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
            >
              {textos.limpar}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
