import { lerAviso } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaStatus from '@/screens/status/TelaStatus';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

export default async function PaginaStatus({
  searchParams,
}: PageProps<'/status'>) {
  const acesso = await obterAcessoAdministrativo();
  const { aviso } = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="status">
      <TelaStatus acesso={acesso} aviso={lerAviso(aviso)} />
    </EstruturaPainel>
  );
}
