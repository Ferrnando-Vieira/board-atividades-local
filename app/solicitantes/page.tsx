import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import TelaSolicitantes from '@/screens/solicitantes/TelaSolicitantes';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

// Só o proprietário define o solicitante padrão: não há rota equivalente
// dentro de /compartilhado.
export default async function PaginaSolicitantes() {
  const acesso = await obterAcessoAdministrativo();
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="solicitantes">
      <TelaSolicitantes />
    </EstruturaPainel>
  );
}
