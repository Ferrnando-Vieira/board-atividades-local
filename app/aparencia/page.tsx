import TelaAparencia from '@/screens/aparencia/TelaAparencia';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

export default async function PaginaAparencia() {
  const acesso = await obterAcessoAdministrativo();
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="aparencia">
      <TelaAparencia acesso={acesso} />
    </EstruturaPainel>
  );
}
