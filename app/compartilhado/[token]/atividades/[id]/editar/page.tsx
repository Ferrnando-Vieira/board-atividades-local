import { notFound } from 'next/navigation';
import { lerIdentificadorRota } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaEdicaoAtividade from '@/screens/atividades/TelaEdicaoAtividade';
import { exigirGestaoCompartilhada } from '@/servidor/web/acessoPainel';

export default async function PaginaEdicaoAtividadeCompartilhada({
  params,
}: PageProps<'/compartilhado/[token]/atividades/[id]/editar'>) {
  const { token, id } = await params;
  const acesso = await exigirGestaoCompartilhada(token);
  const atividadeId = lerIdentificadorRota(id);
  if (atividadeId === null) {
    notFound();
  }
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="quadro">
      <TelaEdicaoAtividade acesso={acesso} atividadeId={atividadeId} />
    </EstruturaPainel>
  );
}
