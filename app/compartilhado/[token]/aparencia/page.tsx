import TelaAparencia from '@/screens/aparencia/TelaAparencia';
import EstruturaPainel from '@/screens/aplicacao/EstruturaPainel';
import { exigirAparenciaCompartilhada } from '@/servidor/web/acessoPainel';

// Aparência própria de um link nomeado (completo ou restrito): vale só para
// quem entra por ele. O link padrão (público) responde como inexistente.
export default async function PaginaAparenciaCompartilhada({
  params,
}: PageProps<'/compartilhado/[token]/aparencia'>) {
  const acesso = await exigirAparenciaCompartilhada((await params).token);
  return (
    <EstruturaPainel acesso={acesso} secaoAtiva="aparencia">
      <TelaAparencia acesso={acesso} />
    </EstruturaPainel>
  );
}
