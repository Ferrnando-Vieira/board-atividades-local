'use client';

import { useActionState, useId } from 'react';
import Botao from '@/components/ui/Botao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_FUNDO } from '@/config/camposFormulario';
import {
  CHAVES_FUNDO_BOARD,
  FUNDOS_BOARD,
  montarEstiloFundoBoard,
  type ChaveFundoBoard,
  type TipoFundoPredefinido,
} from '@/config/fundosBoard';
import { textosAparencia as textos } from '@/screens/aparencia/textosAparencia';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { salvarFundoFormulario } from '@/servidor/web/acoes/acoesFundo';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { lerValorTexto } from '@/util/FormularioUtils';

const ORDEM_GRUPOS: readonly TipoFundoPredefinido[] = [
  'tema',
  'solido',
  'linear',
  'radial',
  'malha',
];

type PropriedadesFormularioFundo = {
  // Link nomeado editando a própria aparência; nula no painel do proprietário.
  credencial: string | null;
  // Nulo quando o fundo em uso é um gradiente personalizado ou uma imagem.
  fundoAtual: ChaveFundoBoard | null;
};

// Cada opção mostra a prévia com o mesmo estilo que o board recebe. Depois
// de uma falha, o formulário volta com a opção que foi enviada.
export default function FormularioFundo({
  credencial,
  fundoAtual,
}: PropriedadesFormularioFundo) {
  const [estado, acao, pendente] = useActionState(
    salvarFundoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const idDica = useId();
  const selecionado =
    lerValorTexto(estado.valores, CAMPOS_FUNDO.FUNDO) ?? fundoAtual;
  return (
    <form key={estado.tentativa} action={acao} className="flex flex-col gap-4">
      <CampoCredencial credencial={credencial} />
      <fieldset aria-describedby={idDica} className="flex flex-col gap-4">
        <legend className="text-sm font-medium">{textos.legendaFundo}</legend>
        <p id={idDica} className="text-xs text-texto-suave">
          {textos.dicaFundo}
        </p>
        {ORDEM_GRUPOS.map((grupo) => {
          const chaves = CHAVES_FUNDO_BOARD.filter(
            (chave) => FUNDOS_BOARD[chave].tipo === grupo,
          );
          return (
            <div key={grupo} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-texto-suave uppercase">
                {textos.gruposPredefinidos[grupo]}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {chaves.map((chave) => (
                  <label
                    key={chave}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-borda bg-superficie p-2.5 transition-colors hover:border-texto-suave/40 has-checked:border-primaria has-checked:bg-primaria-suave/50 has-checked:ring-2 has-checked:ring-primaria has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primaria"
                  >
                    <input
                      type="radio"
                      name={CAMPOS_FUNDO.FUNDO}
                      value={chave}
                      defaultChecked={chave === selecionado}
                      disabled={pendente}
                      className="size-4 shrink-0 accent-primaria"
                    />
                    <span
                      aria-hidden="true"
                      className="size-10 shrink-0 rounded-lg border border-borda bg-fundo"
                      style={montarEstiloFundoBoard(chave)}
                    />
                    <span className="text-sm">
                      {FUNDOS_BOARD[chave].rotulo}
                      {chave === fundoAtual && (
                        <span className="text-texto-suave">{` (${textos.fundoAtual})`}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </fieldset>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div>
        <Botao type="submit" disabled={pendente}>
          {pendente ? textos.botaoSalvando : textos.botaoSalvar}
        </Botao>
      </div>
    </form>
  );
}
