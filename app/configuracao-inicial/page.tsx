import TelaConfiguracaoInicial from '@/screens/configuracaoInicial/TelaConfiguracaoInicial';
import { obterEstadoAntesDaConfiguracao } from '@/servidor/web/acessoAdministrativo';

export default async function PaginaConfiguracaoInicial() {
  const estado = await obterEstadoAntesDaConfiguracao();
  return <TelaConfiguracaoInicial estado={estado} />;
}
