import {
  PARAMETRO_CONFIGURACAO_CONCLUIDA,
  VALOR_CONFIGURACAO_CONCLUIDA,
} from '@/config/rotas';
import TelaEntrada from '@/screens/entrar/TelaEntrada';
import { garantirTelaEntradaDisponivel } from '@/servidor/web/acessoAdministrativo';

export default async function PaginaEntrar({
  searchParams,
}: PageProps<'/entrar'>) {
  await garantirTelaEntradaDisponivel();
  const parametros = await searchParams;
  return (
    <TelaEntrada
      configuracaoConcluida={
        parametros[PARAMETRO_CONFIGURACAO_CONCLUIDA] ===
        VALOR_CONFIGURACAO_CONCLUIDA
      }
    />
  );
}
