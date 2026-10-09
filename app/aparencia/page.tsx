import TelaAparencia from '@/screens/aparencia/TelaAparencia';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';

// O proprietário altera aqui a aparência do board, vista por todos; cada
// link nomeado tem a sua em /compartilhado/<token>/aparencia.
export default async function PaginaAparencia() {
  const acesso = await obterAcessoAdministrativo();
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="aparencia">
      <TelaAparencia acesso={acesso} />
    </EstruturaPainel>
  );
}
