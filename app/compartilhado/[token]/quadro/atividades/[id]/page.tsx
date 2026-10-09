import { notFound, redirect } from 'next/navigation';
import {
  lerIdentificadorRota,
  montarPrefixoCompartilhamento,
  montarRotaAtividade,
} from '@/config/rotas';

// Versão do link compartilhado: aberto direto, leva à página completa da
// atividade, que confere o token e o escopo do link.
export default async function PaginaAtividadeNoQuadroCompartilhada({
  params,
}: PageProps<'/compartilhado/[token]/quadro/atividades/[id]'>): Promise<never> {
  const { token, id } = await params;
  const atividadeId = lerIdentificadorRota(id);
  if (atividadeId === null) {
    notFound();
  }
  redirect(
    montarRotaAtividade(atividadeId, montarPrefixoCompartilhamento(token)),
  );
}
