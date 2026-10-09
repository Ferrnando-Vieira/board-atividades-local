import { notFound } from 'next/navigation';
import { lerAviso, lerIdentificadorRota } from '@/config/rotas';
import ModalDetalheAtividade from '@/screens/atividades/ModalDetalheAtividade';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

// Cartão clicado no quadro: o detalhe abre em modal e o quadro fica atrás.
// Acesso direto ao endereço cai em app/quadro/atividades/[id], que leva à
// página completa.
export default async function ModalAtividade({
  params,
  searchParams,
}: PageProps<'/quadro/atividades/[id]'>) {
  const acesso = await obterAcessoAdministrativo();
  const atividadeId = lerIdentificadorRota((await params).id);
  if (atividadeId === null) {
    notFound();
  }
  const { aviso } = await searchParams;
  return (
    <ModalDetalheAtividade
      acesso={acesso}
      atividadeId={atividadeId}
      aviso={lerAviso(aviso)}
    />
  );
}
