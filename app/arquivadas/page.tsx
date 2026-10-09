import { lerAviso } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaArquivadas from '@/screens/arquivadas/TelaArquivadas';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

export default async function PaginaArquivadas({
  searchParams,
}: PageProps<'/arquivadas'>) {
  const acesso = await obterAcessoAdministrativo();
  const { aviso } = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="arquivadas">
      <TelaArquivadas acesso={acesso} aviso={lerAviso(aviso)} />
    </EstruturaPainel>
  );
}
