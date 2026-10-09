import { notFound, redirect } from 'next/navigation';
import { lerIdentificadorRota, montarRotaAtividade } from '@/config/rotas';

// Endereço dos cartões do quadro. Pelo quadro ele abre em modal (rota
// interceptada em app/@modal); aberto direto (nova aba, recarga), leva à
// página completa, que confere a sessão.
export default async function PaginaAtividadeNoQuadro({
  params,
}: PageProps<'/quadro/atividades/[id]'>): Promise<never> {
  const atividadeId = lerIdentificadorRota((await params).id);
  if (atividadeId === null) {
    notFound();
  }
  redirect(montarRotaAtividade(atividadeId));
}
