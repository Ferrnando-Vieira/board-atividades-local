import { lerAviso } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaTags from '@/screens/tags/TelaTags';
import { exigirGestaoCompartilhada } from '@/servidor/web/acessoPainel';

export default async function PaginaTagsCompartilhadas({
  params,
  searchParams,
}: PageProps<'/compartilhado/[token]/tags'>) {
  const acesso = await exigirGestaoCompartilhada((await params).token);
  const { aviso } = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="tags">
      <TelaTags acesso={acesso} aviso={lerAviso(aviso)} />
    </EstruturaPainel>
  );
}
