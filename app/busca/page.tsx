import { lerTermoBusca, PARAMETRO_BUSCA } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaBusca from '@/screens/busca/TelaBusca';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

export default async function PaginaBusca({
  searchParams,
}: PageProps<'/busca'>) {
  const acesso = await obterAcessoAdministrativo();
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
