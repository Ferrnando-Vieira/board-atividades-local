import { notFound } from 'next/navigation';
import { lerAviso, lerIdentificadorRota } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaDetalheAtividade from '@/screens/atividades/TelaDetalheAtividade';
import { exigirAcessoCompartilhado } from '@/servidor/web/acessoPainel';

// Atividade fora do escopo do link responde 404, igual a uma inexistente.
export default async function PaginaAtividadeCompartilhada({
  params,
  searchParams,
}: PageProps<'/compartilhado/[token]/atividades/[id]'>) {
  const { token, id } = await params;
  const acesso = await exigirAcessoCompartilhado(token);
  const atividadeId = lerIdentificadorRota(id);
  if (atividadeId === null) {
    notFound();
  }
  const { aviso } = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="quadro">
      <TelaDetalheAtividade
        acesso={acesso}
        atividadeId={atividadeId}
        aviso={lerAviso(aviso)}
      />
    </EstruturaPainel>
  );
}
