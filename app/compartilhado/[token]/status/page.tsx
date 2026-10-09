import { lerAviso } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaStatus from '@/screens/status/TelaStatus';
import { exigirGestaoCompartilhada } from '@/servidor/web/acessoPainel';

export default async function PaginaStatusCompartilhado({
  params,
  searchParams,
}: PageProps<'/compartilhado/[token]/status'>) {
  const acesso = await exigirGestaoCompartilhada((await params).token);
  const { aviso } = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="status">
      <TelaStatus acesso={acesso} aviso={lerAviso(aviso)} />
    </EstruturaPainel>
  );
}
