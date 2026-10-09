'use client';

import { useActionState, useId, useState } from 'react';
import SeletorAnimal from '@/components/animais/SeletorAnimal';
import Botao from '@/components/ui/Botao';
import CampoCopiavel from '@/components/ui/CampoCopiavel';
import CampoFormulario from '@/components/ui/CampoFormulario';
import CampoMarcacao from '@/components/ui/CampoMarcacao';
import CampoSelecao from '@/components/ui/CampoSelecao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { ehChaveAnimal } from '@/config/animais';
import { CAMPOS_COMPARTILHAMENTO } from '@/config/camposFormulario';
import {
  LIMITES_TEXTO,
  MODALIDADES_COMPARTILHAMENTO,
  VALOR_CAMPO_MARCADO,
  type ModalidadeCompartilhamento,
} from '@/config/constantes';
import { OPCOES_VALIDADE_DIAS } from '@/config/constantesSeguranca';
import {
  descreverValidade,
  textosCompartilhamento as textos,
} from '@/screens/compartilhamento/textosCompartilhamento';
import type { OpcaoEscopo } from '@/screens/compartilhamento/tiposCompartilhamento';
import { criarLinkCompartilhamentoFormulario } from '@/servidor/web/acoes/acoesCompartilhamento';
import {
  ESTADO_CRIACAO_CREDENCIAL_INICIAL,
  type ValoresFormulario,
} from '@/types/formulario';
import { lerValorLista, lerValorTexto } from '@/util/FormularioUtils';

const MODALIDADE_PADRAO: ModalidadeCompartilhamento = 'restrito';

const OPCOES_VALIDADE = [
  { valor: '', rotulo: textos.semExpiracao },
  ...OPCOES_VALIDADE_DIAS.map((dias) => ({
    valor: String(dias),
    rotulo: descreverValidade(dias),
  })),
];

function lerModalidade(
  valores: ValoresFormulario | undefined,
): ModalidadeCompartilhamento {
  const valor = lerValorTexto(valores, CAMPOS_COMPARTILHAMENTO.MODALIDADE);
  return (
    MODALIDADES_COMPARTILHAMENTO.find((item) => item === valor) ??
    MODALIDADE_PADRAO
  );
}

type PropriedadesGrupoEscopo = {
  legenda: string;
  vazio: string;
  nome: string;
  opcoes: readonly OpcaoEscopo[];
  marcados: ReadonlySet<string>;
  erros?: string[];
};

function GrupoEscopo({
  legenda,
  vazio,
  nome,
  opcoes,
  marcados,
  erros,
}: PropriedadesGrupoEscopo) {
  const prefixo = useId();
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-borda p-3">
      <legend className="px-1 text-sm font-semibold">{legenda}</legend>
      {opcoes.length === 0 ? (
        <p className="text-xs text-texto-suave">{vazio}</p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {opcoes.map((opcao) => (
            <li key={opcao.id}>
              <CampoMarcacao
                id={`${prefixo}-${opcao.id}`}
                name={nome}
                value={String(opcao.id)}
                rotulo={textos.descreverOpcao(
                  opcao.nome,
                  opcao.quantidadeAtividades,
                )}
                defaultChecked={marcados.has(String(opcao.id))}
              />
            </li>
          ))}
        </ul>
      )}
      {erros && erros.length > 0 && (
        <p className="text-xs text-erro">{erros.join(' ')}</p>
      )}
    </fieldset>
  );
}

type PropriedadesCampos = {
  valores: ValoresFormulario | undefined;
  erros: Partial<Record<string, string[]>>;
  tags: readonly OpcaoEscopo[];
  solicitantes: readonly OpcaoEscopo[];
};

// Remontado a cada resposta (key): os campos voltam com o que foi enviado
// quando há erro e limpos depois de gerar o link.
function CamposNovoLink({
  valores,
  erros,
  tags,
  solicitantes,
}: PropriedadesCampos) {
  const [modalidade, setModalidade] = useState(() => lerModalidade(valores));
  const prefixo = useId();
  const tagsMarcadas = new Set(
    lerValorLista(valores, CAMPOS_COMPARTILHAMENTO.TAGS) ?? [],
  );
  const solicitantesMarcados = new Set(
    lerValorLista(valores, CAMPOS_COMPARTILHAMENTO.SOLICITANTES) ?? [],
  );
  const animalEnviado = lerValorTexto(valores, CAMPOS_COMPARTILHAMENTO.ANIMAL);
  return (
    <div className="flex flex-col gap-4">
      <CampoFormulario
        id={`${prefixo}-nome`}
        name={CAMPOS_COMPARTILHAMENTO.NOME}
        rotulo={textos.rotuloNome}
        dica={textos.dicaNome}
        defaultValue={lerValorTexto(valores, CAMPOS_COMPARTILHAMENTO.NOME)}
        erros={erros[CAMPOS_COMPARTILHAMENTO.NOME]}
        maxLength={LIMITES_TEXTO.NOME_LINK_COMPARTILHAMENTO}
        autoComplete="off"
        required
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">
          {textos.legendaModalidade}
        </legend>
        {MODALIDADES_COMPARTILHAMENTO.map((opcao) => (
          <div key={opcao} className="flex items-start gap-3">
            <input
              id={`${prefixo}-${opcao}`}
              type="radio"
              name={CAMPOS_COMPARTILHAMENTO.MODALIDADE}
              value={opcao}
              checked={modalidade === opcao}
              onChange={() => setModalidade(opcao)}
              aria-describedby={`${prefixo}-${opcao}-descricao`}
              className="mt-1 size-5 shrink-0 accent-primaria"
            />
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor={`${prefixo}-${opcao}`}
                className="text-sm font-medium"
              >
                {textos.modalidades[opcao].rotulo}
              </label>
              <p
                id={`${prefixo}-${opcao}-descricao`}
                className="text-xs text-texto-suave"
              >
                {textos.modalidades[opcao].descricao}
              </p>
            </div>
          </div>
        ))}
      </fieldset>
      {modalidade === 'restrito' && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <GrupoEscopo
              legenda={textos.legendaTags}
              vazio={textos.semTags}
              nome={CAMPOS_COMPARTILHAMENTO.TAGS}
              opcoes={tags}
              marcados={tagsMarcadas}
              erros={erros[CAMPOS_COMPARTILHAMENTO.TAGS]}
            />
            <GrupoEscopo
              legenda={textos.legendaSolicitantes}
              vazio={textos.semSolicitantes}
              nome={CAMPOS_COMPARTILHAMENTO.SOLICITANTES}
              opcoes={solicitantes}
              marcados={solicitantesMarcados}
              erros={erros[CAMPOS_COMPARTILHAMENTO.SOLICITANTES]}
            />
          </div>
          <CampoMarcacao
            id={`${prefixo}-arquivadas`}
            name={CAMPOS_COMPARTILHAMENTO.INCLUIR_ARQUIVADAS}
            value={VALOR_CAMPO_MARCADO}
            rotulo={textos.rotuloIncluirArquivadas}
            defaultChecked={
              lerValorTexto(
                valores,
                CAMPOS_COMPARTILHAMENTO.INCLUIR_ARQUIVADAS,
              ) === VALOR_CAMPO_MARCADO
            }
          />
        </>
      )}
      <CampoSelecao
        id={`${prefixo}-validade`}
        name={CAMPOS_COMPARTILHAMENTO.VALIDADE}
        rotulo={textos.rotuloValidade}
        opcoes={OPCOES_VALIDADE}
        defaultValue={
          lerValorTexto(valores, CAMPOS_COMPARTILHAMENTO.VALIDADE) ?? ''
        }
        erros={erros[CAMPOS_COMPARTILHAMENTO.VALIDADE]}
      />
      <SeletorAnimal
        nome={CAMPOS_COMPARTILHAMENTO.ANIMAL}
        legenda={textos.legendaAnimal}
        dica={textos.dicaAnimal}
        rotuloSorteado={textos.animalSorteado}
        valorInicial={ehChaveAnimal(animalEnviado) ? animalEnviado : null}
        erros={erros[CAMPOS_COMPARTILHAMENTO.ANIMAL]}
      />
    </div>
  );
}

type PropriedadesFormularioNovoLink = {
  tags: readonly OpcaoEscopo[];
  solicitantes: readonly OpcaoEscopo[];
};

export default function FormularioNovoLink({
  tags,
  solicitantes,
}: PropriedadesFormularioNovoLink) {
  const [estado, acao, pendente] = useActionState(
    criarLinkCompartilhamentoFormulario,
    ESTADO_CRIACAO_CREDENCIAL_INICIAL,
  );
  const idLink = useId();
  return (
    <form action={acao} noValidate className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">{textos.tituloNovo}</h3>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.credencialGerada && (
        <div className="flex flex-col gap-2">
          <MensagemAlerta tipo="sucesso">
            {estado.mensagemSucesso}
          </MensagemAlerta>
          <CampoCopiavel
            id={idLink}
            rotulo={textos.rotuloLinkGerado}
            valor={estado.credencialGerada}
            rotuloCopiar={textos.botaoCopiar}
            avisoCopiado={textos.avisoCopiado}
            avisoSelecionado={textos.avisoSelecionado}
          />
        </div>
      )}
      <CamposNovoLink
        key={estado.tentativa}
        valores={estado.valores}
        erros={estado.errosCampos ?? {}}
        tags={tags}
        solicitantes={solicitantes}
      />
      <div>
        <Botao type="submit" disabled={pendente}>
          {pendente ? textos.botaoGerando : textos.botaoGerar}
        </Botao>
      </div>
    </form>
  );
}
