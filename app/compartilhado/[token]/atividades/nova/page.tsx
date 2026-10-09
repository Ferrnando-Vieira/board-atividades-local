import { lerIdentificadorRota, PARAMETRO_STATUS_INICIAL } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaNovaAtividade from '@/screens/atividades/TelaNovaAtividade';
import { exigirGestaoCompartilhada } from '@/servidor/web/acessoPainel';

export default async function PaginaNovaAtividadeCompartilhada({
  params,
  searchParams,
}: PageProps<'/compartilhado/[token]/atividades/nova'>) {
  const acesso = await exigirGestaoCompartilhada((await params).token);
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
