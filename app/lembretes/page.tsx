import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaLembretes from '@/screens/lembretes/TelaLembretes';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

// Lembretes são do proprietário: não há rota equivalente em /compartilhado.
export default async function PaginaLembretes() {
  const acesso = await obterAcessoAdministrativo();
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="lembretes">
      <TelaLembretes />
    </EstruturaPainel>
  );
}
