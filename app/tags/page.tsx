import { lerAviso } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaTags from '@/screens/tags/TelaTags';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

export default async function PaginaTags({ searchParams }: PageProps<'/tags'>) {
  const acesso = await obterAcessoAdministrativo();
  const { aviso } = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="tags">
      <TelaTags acesso={acesso} aviso={lerAviso(aviso)} />
    </EstruturaPainel>
  );
}
