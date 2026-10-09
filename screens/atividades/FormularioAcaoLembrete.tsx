'use client';

import { useActionState } from 'react';
import Botao, { type VarianteBotao } from '@/components/ui/Botao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_LEMBRETE } from '@/config/camposFormulario';
import type { OperacaoLembrete } from '@/screens/atividades/descricaoLembrete';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import {
  ativarLembreteFormulario,
  desativarLembreteFormulario,
  excluirLembreteFormulario,
} from '@/servidor/web/acoes/acoesLembretes';
import {
  ESTADO_FORMULARIO_GESTAO_INICIAL,
  type EstadoFormularioGestao,
} from '@/types/formulario';

const CONFIGURACAO_OPERACOES = {
  ativar: {
    acao: ativarLembreteFormulario,
    rotulo: textosAtividades.ativarLembrete,
    rotuloPendente: textosAtividades.ativandoLembrete,
    variante: 'primario',
  },
  desativar: {
    acao: desativarLembreteFormulario,
    rotulo: textosAtividades.desativarLembrete,
    rotuloPendente: textosAtividades.desativandoLembrete,
    variante: 'secundario',
  },
  excluir: {
    acao: excluirLembreteFormulario,
    rotulo: textosAtividades.excluirLembrete,
    rotuloPendente: textosAtividades.excluindoLembrete,
    variante: 'secundario',
  },
} as const satisfies Record<
  OperacaoLembrete,
  {
    acao: (
      estado: EstadoFormularioGestao,
      dados: FormData,
    ) => Promise<EstadoFormularioGestao>;
    rotulo: string;
    rotuloPendente: string;
    variante: VarianteBotao;
  }
>;

type PropriedadesFormularioAcaoLembrete = {
  operacao: OperacaoLembrete;
  atividadeId: number;
  versao: number;
};

export default function FormularioAcaoLembrete({
  operacao,
  atividadeId,
  versao,
}: PropriedadesFormularioAcaoLembrete) {
  const configuracao = CONFIGURACAO_OPERACOES[operacao];
  const [estado, acao, pendente] = useActionState(
    configuracao.acao,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  return (
    <form action={acao} className="flex flex-col gap-2">
      <input
        type="hidden"
        name={CAMPOS_LEMBRETE.ATIVIDADE_ID}
        value={atividadeId}
      />
      <input type="hidden" name={CAMPOS_LEMBRETE.VERSAO} value={versao} />
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      <Botao type="submit" variante={configuracao.variante} disabled={pendente}>
        {pendente ? configuracao.rotuloPendente : configuracao.rotulo}
      </Botao>
    </form>
  );
}
