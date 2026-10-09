import type { CSSProperties } from 'react';
import type { Aviso } from '@/config/rotas';
import ModalRotaAtividade from '@/screens/atividades/ModalRotaAtividade';
import TelaDetalheAtividade, {
  montarIdTituloAtividade,
} from '@/screens/atividades/TelaDetalheAtividade';
import { montarAparenciaPainel } from '@/servidor/board/aparenciaBoard';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';

type PropriedadesModalDetalheAtividade = {
  acesso: AcessoPainel;
  atividadeId: number;
  aviso: Aviso | null;
};

export default function ModalDetalheAtividade({
  acesso,
  atividadeId,
  aviso,
}: PropriedadesModalDetalheAtividade) {
  const { variaveis } = montarAparenciaPainel(
    obterBancoAplicacao(),
    acesso.prefixoRotas,
  );
  return (
    <ModalRotaAtividade
      idTitulo={montarIdTituloAtividade(atividadeId)}
      estilo={variaveis as CSSProperties}
    >
      <TelaDetalheAtividade
        acesso={acesso}
        atividadeId={atividadeId}
        aviso={aviso}
        variante="modal"
      />
    </ModalRotaAtividade>
  );
}
