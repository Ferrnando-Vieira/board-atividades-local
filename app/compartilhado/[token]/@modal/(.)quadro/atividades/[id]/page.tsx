import { notFound } from 'next/navigation';
import { lerAviso, lerIdentificadorRota } from '@/config/rotas';
import ModalDetalheAtividade from '@/screens/atividades/ModalDetalheAtividade';
import { exigirAcessoCompartilhado } from '@/servidor/web/acessoPainel';

// Versão do link compartilhado do detalhe em modal; o escopo do link vale
// igual ao da página completa (fora dele, 404).
export default async function ModalAtividadeCompartilhada({
  params,
  searchParams,
}: PageProps<'/compartilhado/[token]/quadro/atividades/[id]'>) {
  const { token, id } = await params;
  const acesso = await exigirAcessoCompartilhado(token);
  const atividadeId = lerIdentificadorRota(id);
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
