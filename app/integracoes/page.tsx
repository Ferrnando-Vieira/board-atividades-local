import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaIntegracoes from '@/screens/integracoes/TelaIntegracoes';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

// Só o proprietário lista, emite e revoga tokens: não há rota equivalente
// dentro de /compartilhado nem na própria API.
export default async function PaginaIntegracoes() {
  const acesso = await obterAcessoAdministrativo();
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="integracoes">
      <TelaIntegracoes />
    </EstruturaPainel>
  );
}
