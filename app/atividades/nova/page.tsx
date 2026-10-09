import { lerIdentificadorRota, PARAMETRO_STATUS_INICIAL } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaNovaAtividade from '@/screens/atividades/TelaNovaAtividade';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

export default async function PaginaNovaAtividade({
  searchParams,
}: PageProps<'/atividades/nova'>) {
  const acesso = await obterAcessoAdministrativo();
  const parametros = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="quadro">
      <TelaNovaAtividade
        acesso={acesso}
        statusSugeridoId={lerIdentificadorRota(
          parametros[PARAMETRO_STATUS_INICIAL],
        )}
      />
    </EstruturaPainel>
  );
}
