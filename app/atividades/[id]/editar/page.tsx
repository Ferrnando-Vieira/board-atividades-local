import { notFound } from 'next/navigation';
import { lerIdentificadorRota } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaEdicaoAtividade from '@/screens/atividades/TelaEdicaoAtividade';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

export default async function PaginaEdicaoAtividade({
  params,
}: PageProps<'/atividades/[id]/editar'>) {
  const acesso = await obterAcessoAdministrativo();
  const atividadeId = lerIdentificadorRota((await params).id);
  if (atividadeId === null) {
    notFound();
  }
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="quadro">
      <TelaEdicaoAtividade acesso={acesso} atividadeId={atividadeId} />
    </EstruturaPainel>
  );
}
