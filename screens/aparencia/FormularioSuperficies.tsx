'use client';

import { useActionState, useId, useState, type CSSProperties } from 'react';
import Botao from '@/components/ui/Botao';
import CampoCor from '@/components/ui/CampoCor';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import {
  CORES_SUGERIDAS_SUPERFICIE,
  LIMITES_OPACIDADE,
  MODOS_TOM_TEXTO,
  SUPERFICIES_PADRAO,
  type ModoTomTexto,
  type SuperficiesBoard,
} from '@/config/aparenciaBoard';
import { CAMPOS_SUPERFICIES } from '@/config/camposFormulario';
import PreviaBoard from '@/screens/aparencia/PreviaBoard';
import { textosAparencia as textos } from '@/screens/aparencia/textosAparencia';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { salvarSuperficiesFormulario } from '@/servidor/web/acoes/acoesFundo';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import {
  calcularAparenciaColuna,
  type AparenciaSuperficie,
} from '@/util/AparenciaUtils';
import { combinarClasses } from '@/util/ClassesUtils';
import { classificarLeitura, type NivelLeitura } from '@/util/CorUtils';

const CLASSES_LEITURA: Record<NivelLeitura, string> = {
  boa: 'bg-sucesso-fundo text-sucesso',
  atencao: 'bg-aviso-fundo text-aviso',
  dificil: 'bg-erro-fundo text-erro',
};

type PropriedadesCampoOpacidade = {
  nome: string;
  rotulo: string;
  valor: number;
  aoAlterar: (valor: number) => void;
  erros?: string[];
};

function CampoOpacidade({
  nome,
  rotulo,
  valor,
  aoAlterar,
  erros,
}: PropriedadesCampoOpacidade) {
  const id = useId();
  const idDica = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}:{' '}
        <span className="tabular-nums">{textos.descreverOpacidade(valor)}</span>
      </label>
      <input
        id={id}
        type="range"
        name={nome}
        min={LIMITES_OPACIDADE.MINIMA}
        max={LIMITES_OPACIDADE.MAXIMA}
        step={LIMITES_OPACIDADE.PASSO}
        value={valor}
        onChange={(evento) => aoAlterar(Number(evento.target.value))}
        aria-describedby={idDica}
        className="min-h-8 accent-primaria"
      />
      <p id={idDica} className="text-xs text-texto-suave">
        {textos.dicaOpacidade}
      </p>
      {erros && <p className="text-xs text-erro">{erros.join(' ')}</p>}
    </div>
  );
}

function IndicadorLeitura({
  rotulo,
  superficie,
}: {
  rotulo: string;
  superficie: AparenciaSuperficie;
}) {
  const nivel = classificarLeitura(superficie.contraste);
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-texto-suave">{rotulo}:</span>
      <span
        className={combinarClasses(
          'rounded-full px-2 py-0.5 font-semibold',
          CLASSES_LEITURA[nivel],
        )}
      >
        {textos.niveisLeitura[nivel]}
      </span>
      <span className="text-texto-suave">
        ({textos.descreverContraste(superficie.contraste)})
      </span>
    </p>
  );
}

type PropriedadesFormularioSuperficies = {
  // Link nomeado editando a própria aparência; nula no painel do proprietário.
  credencial: string | null;
  superficiesAtuais: SuperficiesBoard;
  amostrasFundo: readonly string[];
  estiloFundo: CSSProperties | undefined;
};

export default function FormularioSuperficies({
  credencial,
  superficiesAtuais,
  amostrasFundo,
  estiloFundo,
}: PropriedadesFormularioSuperficies) {
  const [estado, acao, pendente] = useActionState(
    salvarSuperficiesFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [superficies, setSuperficies] =
    useState<SuperficiesBoard>(superficiesAtuais);
  const erros = estado.errosCampos ?? {};
  const aparencia = calcularAparenciaColuna(amostrasFundo, superficies);

  function alterar<Campo extends keyof SuperficiesBoard>(
    campo: Campo,
    valor: SuperficiesBoard[Campo],
  ): void {
    setSuperficies((atuais) => ({ ...atuais, [campo]: valor }));
  }

  return (
    <form action={acao} className="flex flex-col gap-5">
      <CampoCredencial credencial={credencial} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-xl border border-borda p-4">
              <CampoCor
                nome={CAMPOS_SUPERFICIES.COR_TITULOS}
                rotulo={textos.rotuloCorTitulos}
                valor={superficies.corTitulos}
                sugestoes={CORES_SUGERIDAS_SUPERFICIE}
                erros={erros[CAMPOS_SUPERFICIES.COR_TITULOS]}
                aoAlterar={(cor) => alterar('corTitulos', cor)}
              />
              <CampoOpacidade
                nome={CAMPOS_SUPERFICIES.OPACIDADE_TITULOS}
                rotulo={textos.rotuloOpacidadeTitulos}
                valor={superficies.opacidadeTitulos}
                erros={erros[CAMPOS_SUPERFICIES.OPACIDADE_TITULOS]}
                aoAlterar={(valor) => alterar('opacidadeTitulos', valor)}
              />
              <IndicadorLeitura
                rotulo={textos.rotuloLeituraTitulos}
                superficie={aparencia.titulo}
              />
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-borda p-4">
              <CampoCor
                nome={CAMPOS_SUPERFICIES.COR_COLUNAS}
                rotulo={textos.rotuloCorColunas}
                valor={superficies.corColunas}
                sugestoes={CORES_SUGERIDAS_SUPERFICIE}
                erros={erros[CAMPOS_SUPERFICIES.COR_COLUNAS]}
                aoAlterar={(cor) => alterar('corColunas', cor)}
              />
              <CampoOpacidade
                nome={CAMPOS_SUPERFICIES.OPACIDADE_COLUNAS}
                rotulo={textos.rotuloOpacidadeColunas}
                valor={superficies.opacidadeColunas}
                erros={erros[CAMPOS_SUPERFICIES.OPACIDADE_COLUNAS]}
                aoAlterar={(valor) => alterar('opacidadeColunas', valor)}
              />
              <IndicadorLeitura
                rotulo={textos.rotuloLeituraColunas}
                superficie={aparencia.coluna}
              />
            </div>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              {textos.legendaTomTexto}
            </legend>
            <div className="flex flex-wrap gap-2">
              {MODOS_TOM_TEXTO.map((modo: ModoTomTexto) => (
                <label
                  key={modo}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-borda bg-superficie px-3 text-sm has-checked:border-primaria has-checked:bg-primaria-suave has-checked:text-primaria-escura has-focus-visible:outline-2 has-focus-visible:outline-primaria"
                >
                  <input
                    type="radio"
                    name={CAMPOS_SUPERFICIES.TOM_TEXTO}
                    value={modo}
                    checked={superficies.tomTexto === modo}
                    onChange={() => alterar('tomTexto', modo)}
                    className="size-4 accent-primaria"
                  />
                  {textos.tonsTexto[modo]}
                </label>
              ))}
            </div>
            <p className="text-xs text-texto-suave">{textos.dicaTomTexto}</p>
          </fieldset>
          <p className="text-xs text-texto-suave">
            {textos.dicaColunaPorStatus}
          </p>
        </div>
        <PreviaBoard estiloFundo={estiloFundo} aparencia={aparencia} />
      </div>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente}>
          {pendente ? textos.botaoSalvando : textos.botaoAplicarSuperficies}
        </Botao>
        <Botao
          variante="fantasma"
          onClick={() => setSuperficies(SUPERFICIES_PADRAO)}
        >
          {textos.botaoRestaurarPadrao}
        </Botao>
      </div>
    </form>
  );
}
