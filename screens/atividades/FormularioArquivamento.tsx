'use client';

import { useActionState } from 'react';
import Botao from '@/components/ui/Botao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import {
  CAMPOS_ATIVIDADE,
  RETORNOS_RESTAURACAO,
  type RetornoRestauracao,
} from '@/config/camposFormulario';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import {
  arquivarAtividadeFormulario,
  desarquivarAtividadeFormulario,
} from '@/servidor/web/acoes/acoesAtividades';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';

type PropriedadesArquivamento = {
  atividadeId: number;
  versao: number;
  arquivada: boolean;
  credencial: string | null;
  retorno?: RetornoRestauracao;
};

export default function FormularioArquivamento({
  atividadeId,
  versao,
  arquivada,
  credencial,
  retorno = RETORNOS_RESTAURACAO.DETALHE,
}: PropriedadesArquivamento) {
  const [estado, acao, pendente] = useActionState(
    arquivada ? desarquivarAtividadeFormulario : arquivarAtividadeFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const rotulo = arquivada
    ? textosAtividades.restaurar
    : textosAtividades.arquivar;
  const rotuloPendente = arquivada
    ? textosAtividades.restaurando
    : textosAtividades.arquivando;
  return (
    <form action={acao} className="flex flex-col gap-2">
      <CampoCredencial credencial={credencial} />
      <input
        type="hidden"
        name={CAMPOS_ATIVIDADE.ATIVIDADE_ID}
        value={atividadeId}
      />
      <input type="hidden" name={CAMPOS_ATIVIDADE.VERSAO} value={versao} />
      <input type="hidden" name={CAMPOS_ATIVIDADE.RETORNO} value={retorno} />
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      <Botao
        type="submit"
        variante={arquivada ? 'primario' : 'secundario'}
        disabled={pendente}
      >
        {pendente ? rotuloPendente : rotulo}
      </Botao>
    </form>
  );
}
