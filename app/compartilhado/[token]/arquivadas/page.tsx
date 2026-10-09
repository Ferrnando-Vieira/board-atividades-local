import { lerAviso } from '@/config/rotas';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaArquivadas from '@/screens/arquivadas/TelaArquivadas';
import { exigirArquivadasCompartilhadas } from '@/servidor/web/acessoPainel';

export default async function PaginaArquivadasCompartilhadas({
  params,
  searchParams,
}: PageProps<'/compartilhado/[token]/arquivadas'>) {
  const acesso = await exigirArquivadasCompartilhadas((await params).token);
  const { aviso } = await searchParams;
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="arquivadas">
      <TelaArquivadas acesso={acesso} aviso={lerAviso(aviso)} />
    </EstruturaPainel>
  );
}
