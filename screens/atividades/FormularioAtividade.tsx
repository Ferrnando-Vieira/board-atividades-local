'use client';

import { useActionState, useId } from 'react';
import Botao from '@/components/ui/Botao';
import CampoFormulario from '@/components/ui/CampoFormulario';
import CampoSelecao from '@/components/ui/CampoSelecao';
import LinkBotao from '@/components/ui/LinkBotao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_ATIVIDADE } from '@/config/camposFormulario';
import { LIMITES_TEXTO, PRIORIDADE } from '@/config/constantes';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import CamposDataHora from '@/screens/aplicacao/CamposDataHora';
import CampoAnexosNovos from '@/screens/atividades/CampoAnexosNovos';
import CamposSolicitanteTags from '@/screens/atividades/CamposSolicitanteTags';
import EditorDescricao from '@/screens/atividades/EditorDescricao';
import type { ImagensDescricao } from '@/screens/atividades/imagensDescricao';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { useArquivosPendentes } from '@/screens/atividades/useArquivosPendentes';
import type { ValoresIniciaisAtividade } from '@/screens/atividades/valoresFormularioAtividade';
import type { OpcoesFormularioAtividade } from '@/servidor/atividades/consultasAtividades';
import {
  ESTADO_FORMULARIO_GESTAO_INICIAL,
  type EstadoFormularioGestao,
} from '@/types/formulario';
import { lerValorLista, lerValorTexto } from '@/util/FormularioUtils';
import { HORAS_SUGESTAO_FUTURA } from '@/util/SugestaoDataHoraUtils';

const OPCOES_PRIORIDADE = Array.from(
  { length: PRIORIDADE.MAIS_BAIXA - PRIORIDADE.MAIS_ALTA + 1 },
  (_, indice) => {
    const prioridade = PRIORIDADE.MAIS_ALTA + indice;
    return {
      valor: String(prioridade),
      rotulo: textosAtividades.opcaoPrioridade(prioridade),
    };
  },
);

const LINHAS_DESCRICAO = 6;

type AcaoFormularioAtividade = (
  estado: EstadoFormularioGestao,
  dados: FormData,
) => Promise<EstadoFormularioGestao>;

// Na página, cancelar volta para uma rota; no modal do quadro, só fecha.
type CancelamentoFormulario =
  | { rotaCancelar: string; aoCancelar?: never }
  | { aoCancelar: () => void; rotaCancelar?: never };

type PropriedadesFormularioAtividade = CancelamentoFormulario & {
  modo: 'criacao' | 'edicao';
  acao: AcaoFormularioAtividade;
  valoresIniciais: ValoresIniciaisAtividade;
  opcoes: OpcoesFormularioAtividade;
  credencial: string | null;
  identificacao?: { atividadeId: number; versao: number };
  // Imagens já anexadas à atividade, para a visualização da descrição.
  imagensDescricao?: ImagensDescricao;
};

const SEM_IMAGENS: ImagensDescricao = {};

type CampoTextoAtividade = Exclude<keyof ValoresIniciaisAtividade, 'tags'>;

export default function FormularioAtividade({
  modo,
  acao,
  valoresIniciais,
  opcoes,
  rotaCancelar,
  aoCancelar,
  credencial,
  identificacao,
  imagensDescricao = SEM_IMAGENS,
}: PropriedadesFormularioAtividade) {
  // Fica fora do bloco remontado a cada resposta (key={estado.tentativa}):
  // depois de um erro, os arquivos continuam na tela junto com o texto.
  const arquivosPendentes = useArquivosPendentes();
  const [estado, acaoFormulario, pendente] = useActionState(
    (anterior: EstadoFormularioGestao, dados: FormData) => {
      arquivosPendentes.incluirNoEnvio(dados);
      return acao(anterior, dados);
    },
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  // Prefixo dos ids: o formulário de nova atividade fica montado no quadro
  // enquanto o de edição abre no modal, e os dois não podem repetir ids.
  const prefixo = useId();
  const idCampo = (campo: string) => `${prefixo}-${campo}`;
  const erros = estado.errosCampos ?? {};
  const valor = (campo: CampoTextoAtividade) =>
    lerValorTexto(estado.valores, campo) ?? valoresIniciais[campo];
  const opcoesStatus = opcoes.status.map((status) => ({
    valor: String(status.id),
    rotulo: status.nome,
  }));
  const rotuloEnvio =
    modo === 'criacao'
      ? textosAtividades.botaoCriar
      : textosAtividades.botaoSalvar;
  const imagensVisualizacao = {
    ...imagensDescricao,
    ...arquivosPendentes.imagensPendentes,
  };

  return (
    <form action={acaoFormulario} noValidate className="flex flex-col gap-5">
      <CampoCredencial credencial={credencial} />
      {/* Só para a tela perceber anexos escolhidos ao perguntar se descarta
          o rascunho; o servidor ignora este campo. */}
      <input
        type="hidden"
        name={CAMPOS_ATIVIDADE.RESUMO_ARQUIVOS}
        value={arquivosPendentes.anexos.length}
      />
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      <div key={estado.tentativa} className="flex flex-col gap-5">
        {identificacao && (
          <>
            <input
              type="hidden"
              name={CAMPOS_ATIVIDADE.ATIVIDADE_ID}
              value={identificacao.atividadeId}
            />
            <input
              type="hidden"
              name={CAMPOS_ATIVIDADE.VERSAO}
              value={identificacao.versao}
            />
          </>
        )}
        <CampoFormulario
          id={idCampo(CAMPOS_ATIVIDADE.TITULO)}
          name={CAMPOS_ATIVIDADE.TITULO}
          rotulo={textosAtividades.rotuloTitulo}
          defaultValue={valor('titulo')}
          erros={erros.titulo}
          maxLength={LIMITES_TEXTO.TITULO_ATIVIDADE}
          autoComplete="off"
          required
        />
        <EditorDescricao
          id={idCampo(CAMPOS_ATIVIDADE.DESCRICAO)}
          name={CAMPOS_ATIVIDADE.DESCRICAO}
          rotulo={textosAtividades.rotuloDescricao}
          defaultValue={valor('descricao')}
          erros={erros.descricao}
          maxLength={LIMITES_TEXTO.DESCRICAO_ATIVIDADE}
          rows={LINHAS_DESCRICAO}
          imagens={imagensVisualizacao}
          aoAdicionarImagens={arquivosPendentes.adicionarImagens}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoSelecao
            id={idCampo(CAMPOS_ATIVIDADE.STATUS)}
            name={CAMPOS_ATIVIDADE.STATUS}
            rotulo={textosAtividades.rotuloStatus}
            opcoes={opcoesStatus}
            defaultValue={valor('statusId')}
            erros={erros.statusId}
          />
          <CampoSelecao
            id={idCampo(CAMPOS_ATIVIDADE.PRIORIDADE)}
            name={CAMPOS_ATIVIDADE.PRIORIDADE}
            rotulo={textosAtividades.rotuloPrioridade}
            opcoes={OPCOES_PRIORIDADE}
            defaultValue={valor('prioridade')}
            dica={textosAtividades.dicaPrioridade}
            erros={erros.prioridade}
          />
        </div>
        <CamposSolicitanteTags
          idSolicitante={idCampo(CAMPOS_ATIVIDADE.SOLICITANTE)}
          nomeSolicitante={CAMPOS_ATIVIDADE.SOLICITANTE}
          valorSolicitante={valor('solicitante')}
          errosSolicitante={erros.solicitante}
          sugestoesSolicitantes={opcoes.solicitantes}
          idTags={idCampo('nova-tag')}
          nomeTags={CAMPOS_ATIVIDADE.TAGS}
          tagsIniciais={
            lerValorLista(estado.valores, CAMPOS_ATIVIDADE.TAGS) ??
            valoresIniciais.tags
          }
          sugestoesTags={opcoes.tags}
          errosTags={erros.tags}
          automatico={
            modo === 'criacao' &&
            lerValorTexto(estado.valores, CAMPOS_ATIVIDADE.SOLICITANTE) ===
              undefined
          }
          solicitantesPadraoTags={opcoes.solicitantesPadraoTags}
          solicitantePadrao={opcoes.solicitantePadrao}
        />
        <fieldset className="flex flex-col gap-3 rounded-lg border border-borda p-3">
          <legend className="px-1 text-sm font-semibold">
            {textosAtividades.legendaPrazo}
          </legend>
          <CamposDataHora
            idData={idCampo(CAMPOS_ATIVIDADE.PRAZO_DATA)}
            idHora={idCampo(CAMPOS_ATIVIDADE.PRAZO_HORA)}
            nomeData={CAMPOS_ATIVIDADE.PRAZO_DATA}
            nomeHora={CAMPOS_ATIVIDADE.PRAZO_HORA}
            rotuloData={textosAtividades.rotuloData}
            rotuloHora={textosAtividades.rotuloHoraOpcional}
            valorData={valor('prazoData')}
            valorHora={valor('prazoHora')}
            errosData={erros.prazoData}
            errosHora={erros.prazoHora}
            horasAFrente={HORAS_SUGESTAO_FUTURA}
            fusoHorario={opcoes.fusoHorario}
          />
        </fieldset>
        <fieldset className="flex flex-col gap-3 rounded-lg border border-borda p-3">
          <legend className="px-1 text-sm font-semibold">
            {textosAtividades.legendaConclusao}
          </legend>
          <p className="text-xs text-texto-suave">
            {textosAtividades.dicaConclusao}
          </p>
          {/* Conclusão é algo que já aconteceu: a sugestão é o momento atual. */}
          <CamposDataHora
            idData={idCampo(CAMPOS_ATIVIDADE.CONCLUSAO_DATA)}
            idHora={idCampo(CAMPOS_ATIVIDADE.CONCLUSAO_HORA)}
            nomeData={CAMPOS_ATIVIDADE.CONCLUSAO_DATA}
            nomeHora={CAMPOS_ATIVIDADE.CONCLUSAO_HORA}
            rotuloData={textosAtividades.rotuloData}
            rotuloHora={textosAtividades.rotuloHoraOpcional}
            valorData={valor('concluidaEmData')}
            valorHora={valor('concluidaEmHora')}
            errosData={erros.concluidaEmData}
            errosHora={erros.concluidaEmHora}
            horasAFrente={0}
            fusoHorario={opcoes.fusoHorario}
          />
        </fieldset>
      </div>
      {/* Na edição, os anexos ficam na seção própria do detalhe. */}
      {modo === 'criacao' && (
        <CampoAnexosNovos
          anexos={arquivosPendentes.anexos}
          aoAdicionar={arquivosPendentes.adicionarAnexos}
          aoRemover={arquivosPendentes.remover}
        />
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {aoCancelar && (
          <Botao variante="secundario" onClick={aoCancelar}>
            {textosAtividades.cancelar}
          </Botao>
        )}
        {rotaCancelar !== undefined && (
          <LinkBotao href={rotaCancelar}>{textosAtividades.cancelar}</LinkBotao>
        )}
        <Botao type="submit" disabled={pendente}>
          {pendente ? textosAtividades.botaoSalvando : rotuloEnvio}
        </Botao>
      </div>
    </form>
  );
}
