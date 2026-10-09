import { lerTermoBusca, PARAMETRO_BUSCA } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaBusca from '@/screens/busca/TelaBusca';
import { exigirAcessoCompartilhado } from '@/servidor/web/acessoPainel';

export default async function PaginaBuscaCompartilhada({
  params,
  searchParams,
}: PageProps<'/compartilhado/[token]/busca'>) {
  const acesso = await exigirAcessoCompartilhado((await params).token);
  const parametros = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="busca">
      <TelaBusca
        acesso={acesso}
        termo={lerTermoBusca(parametros[PARAMETRO_BUSCA])}
      />
    </EstruturaPainel>
  );
}
