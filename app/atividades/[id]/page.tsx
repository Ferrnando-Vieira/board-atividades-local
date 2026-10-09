import { notFound } from 'next/navigation';
import { lerAviso, lerIdentificadorRota } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaDetalheAtividade from '@/screens/atividades/TelaDetalheAtividade';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

export default async function PaginaAtividade({
  params,
  searchParams,
}: PageProps<'/atividades/[id]'>) {
  const acesso = await obterAcessoAdministrativo();
  const atividadeId = lerIdentificadorRota((await params).id);
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
