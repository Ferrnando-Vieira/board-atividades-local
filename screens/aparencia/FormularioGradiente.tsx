'use client';

import { useActionState, useId, useState } from 'react';
import Botao from '@/components/ui/Botao';
import CampoCor from '@/components/ui/CampoCor';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import type { SuperficiesBoard } from '@/config/aparenciaBoard';
import { CAMPOS_FUNDO } from '@/config/camposFormulario';
import { VALOR_CAMPO_MARCADO } from '@/config/constantes';
import {
  FORMATOS_GRADIENTE,
  GRADIENTE_PERSONALIZADO_PADRAO,
  LIMITES_GRADIENTE,
  montarEstiloGradientePersonalizado,
  type FormatoGradiente,
  type GradientePersonalizado,
} from '@/config/fundosBoard';
import PreviaBoard from '@/screens/aparencia/PreviaBoard';
import { textosAparencia as textos } from '@/screens/aparencia/textosAparencia';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { salvarGradienteFormulario } from '@/servidor/web/acoes/acoesFundo';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { calcularAparenciaColuna } from '@/util/AparenciaUtils';
import { combinarClasses } from '@/util/ClassesUtils';

const COR_INTERMEDIARIA_SUGERIDA = '#ffffff';
const QUANTIDADE_CORES_COM_INTERMEDIARIA = 3;
const PASSO_ATALHO_ANGULO = 45;
const ATALHOS_ANGULO = Array.from(
  { length: LIMITES_GRADIENTE.ANGULO_MAXIMO / PASSO_ATALHO_ANGULO },
  (_, indice) => indice * PASSO_ATALHO_ANGULO,
);
// Seta que aponta para a direção do ângulo (0° = para cima).
const SETA_DIRECAO = '↑';

function limitarAngulo(valor: number): number {
  if (!Number.isFinite(valor)) {
    return LIMITES_GRADIENTE.ANGULO_MINIMO;
  }
  return Math.min(
    LIMITES_GRADIENTE.ANGULO_MAXIMO,
    Math.max(LIMITES_GRADIENTE.ANGULO_MINIMO, Math.round(valor)),
  );
}

function mesmoGradiente(
  primeiro: GradientePersonalizado,
  segundo: GradientePersonalizado,
): boolean {
  return (
    primeiro.formato === segundo.formato &&
    primeiro.angulo === segundo.angulo &&
    primeiro.cores.join() === segundo.cores.join()
  );
}

type PropriedadesFormularioGradiente = {
  // Link nomeado editando a própria aparência; nula no painel do proprietário.
  credencial: string | null;
  gradienteAtual: GradientePersonalizado;
  emUso: boolean;
  superficies: SuperficiesBoard;
};

// Campos controlados para a prévia acompanhar cada mudança; o estilo da
// prévia sai do mesmo montador usado no board, então o que se vê é o que
// será aplicado. O servidor valida tudo de novo antes de gravar.
export default function FormularioGradiente({
  credencial,
  gradienteAtual,
  emUso,
  superficies,
}: PropriedadesFormularioGradiente) {
  const [estado, acao, pendente] = useActionState(
    salvarGradienteFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const coresIniciais = gradienteAtual.cores;
  const possuiIntermediaria =
    coresIniciais.length === QUANTIDADE_CORES_COM_INTERMEDIARIA;
  const [formato, setFormato] = useState<FormatoGradiente>(
    gradienteAtual.formato,
  );
  const [angulo, setAngulo] = useState(gradienteAtual.angulo);
  const [corInicial, setCorInicial] = useState(
    coresIniciais[0] ?? GRADIENTE_PERSONALIZADO_PADRAO.cores[0],
  );
  const [usarIntermediaria, setUsarIntermediaria] =
    useState(possuiIntermediaria);
  const [corIntermediaria, setCorIntermediaria] = useState(
    (possuiIntermediaria ? coresIniciais[1] : undefined) ??
      COR_INTERMEDIARIA_SUGERIDA,
  );
  const [corFinal, setCorFinal] = useState(
    coresIniciais.at(-1) ?? GRADIENTE_PERSONALIZADO_PADRAO.cores[1],
  );
  const idAngulo = useId();
  const idAnguloNumerico = useId();
  const idDicaAngulo = useId();
  const idUsarIntermediaria = useId();
  const erros = estado.errosCampos ?? {};
  const cores = usarIntermediaria
    ? [corInicial, corIntermediaria, corFinal]
    : [corInicial, corFinal];
  const gradiente: GradientePersonalizado = { formato, angulo, cores };
  const alterado = !mesmoGradiente(gradiente, gradienteAtual);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <CampoCredencial credencial={credencial} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              {textos.legendaFormato}
            </legend>
            <div className="inline-flex w-fit rounded-xl border border-borda bg-fundo p-1">
              {FORMATOS_GRADIENTE.map((opcao) => (
                <label
                  key={opcao}
                  className="flex min-h-9 cursor-pointer items-center rounded-lg px-4 text-sm font-medium text-texto-suave has-checked:bg-superficie has-checked:text-texto has-checked:shadow-cartao has-focus-visible:outline-2 has-focus-visible:outline-primaria"
                >
                  <input
                    type="radio"
                    name={CAMPOS_FUNDO.FORMATO}
                    value={opcao}
                    checked={formato === opcao}
                    onChange={() => setFormato(opcao)}
                    className="sr-only"
                  />
                  {textos.formatos[opcao]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor={idAngulo} className="text-sm font-medium">
                {textos.rotulosAngulo[formato]}:{' '}
                <span className="tabular-nums">
                  {textos.descreverAngulo(angulo)}
                </span>
              </label>
              <span className="flex items-center gap-2">
                <label htmlFor={idAnguloNumerico} className="sr-only">
                  {textos.rotuloAnguloNumerico}
                </label>
                <input
                  id={idAnguloNumerico}
                  type="number"
                  inputMode="numeric"
                  min={LIMITES_GRADIENTE.ANGULO_MINIMO}
                  max={LIMITES_GRADIENTE.ANGULO_MAXIMO}
                  value={angulo}
                  onChange={(evento) =>
                    setAngulo(limitarAngulo(Number(evento.target.value)))
                  }
                  className="h-9 w-20 rounded-lg border border-borda bg-superficie px-2 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-primaria"
                />
              </span>
            </div>
            <input
              id={idAngulo}
              type="range"
              name={CAMPOS_FUNDO.ANGULO}
              min={LIMITES_GRADIENTE.ANGULO_MINIMO}
              max={LIMITES_GRADIENTE.ANGULO_MAXIMO}
              step={1}
              value={angulo}
              onChange={(evento) => setAngulo(Number(evento.target.value))}
              aria-describedby={idDicaAngulo}
              className="min-h-8 accent-primaria"
            />
            <ul
              aria-label={textos.rotuloAtalhosAngulo}
              className="flex flex-wrap gap-1.5"
            >
              {ATALHOS_ANGULO.map((atalho) => (
                <li key={atalho}>
                  <button
                    type="button"
                    aria-label={textos.descreverAtalhoAngulo(atalho)}
                    aria-pressed={angulo === atalho}
                    onClick={() => setAngulo(atalho)}
                    className={combinarClasses(
                      'inline-flex h-8 min-w-12 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-primaria',
                      angulo === atalho
                        ? 'border-primaria bg-primaria-suave text-primaria-escura'
                        : 'border-borda bg-superficie text-texto-suave hover:text-texto',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block"
                      style={{ transform: `rotate(${atalho}deg)` }}
                    >
                      {SETA_DIRECAO}
                    </span>
                    {textos.descreverAngulo(atalho)}
                  </button>
                </li>
              ))}
            </ul>
            <p id={idDicaAngulo} className="text-xs text-texto-suave">
              {textos.dicasAngulo[formato]}
            </p>
            {erros[CAMPOS_FUNDO.ANGULO] && (
              <p className="text-xs text-erro">
                {erros[CAMPOS_FUNDO.ANGULO]?.join(' ')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CampoCor
              nome={CAMPOS_FUNDO.COR_INICIAL}
              rotulo={textos.rotuloCorInicial}
              valor={corInicial}
              erros={erros[CAMPOS_FUNDO.COR_INICIAL]}
              aoAlterar={setCorInicial}
            />
            {usarIntermediaria && (
              <CampoCor
                nome={CAMPOS_FUNDO.COR_INTERMEDIARIA}
                rotulo={textos.rotuloCorIntermediaria}
                valor={corIntermediaria}
                erros={erros[CAMPOS_FUNDO.COR_INTERMEDIARIA]}
                aoAlterar={setCorIntermediaria}
              />
            )}
            <CampoCor
              nome={CAMPOS_FUNDO.COR_FINAL}
              rotulo={textos.rotuloCorFinal}
              valor={corFinal}
              erros={erros[CAMPOS_FUNDO.COR_FINAL]}
              aoAlterar={setCorFinal}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id={idUsarIntermediaria}
              type="checkbox"
              name={CAMPOS_FUNDO.USAR_COR_INTERMEDIARIA}
              value={VALOR_CAMPO_MARCADO}
              checked={usarIntermediaria}
              onChange={(evento) => setUsarIntermediaria(evento.target.checked)}
              className="size-4 accent-primaria"
            />
            <label htmlFor={idUsarIntermediaria} className="text-sm">
              {textos.rotuloUsarCorIntermediaria}
            </label>
          </div>
        </div>
        <PreviaBoard
          estiloFundo={montarEstiloGradientePersonalizado(gradiente)}
          aparencia={calcularAparenciaColuna(cores, superficies)}
        />
      </div>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && !alterado && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente}>
          {pendente ? textos.botaoSalvando : textos.botaoAplicarGradiente}
        </Botao>
        {emUso && !alterado && (
          <span className="rounded-full bg-sucesso-fundo px-3 py-1 text-xs font-medium text-sucesso">
            {textos.emUso}
          </span>
        )}
        {alterado && (
          <span className="rounded-full bg-aviso-fundo px-3 py-1 text-xs font-medium text-aviso">
            {textos.alteracoesNaoAplicadas}
          </span>
        )}
      </div>
    </form>
  );
}
