import { FUSO_HORARIO_PADRAO } from '@/config/constantes';
import { emitirCodigoConfiguracao } from '@/servidor/administracao/configuracaoInicial';
import { fecharBanco } from '@/servidor/banco/conexao';
import { formatarInstanteParaExibicao } from '@/util/DataUtils';
import {
  abrirBancoInicializado,
  carregarAmbiente,
  executarScript,
} from './suporte/suporteScripts';

executarScript(() => {
  const banco = abrirBancoInicializado(carregarAmbiente());
  try {
    const { codigo, expiraEm } = emitirCodigoConfiguracao(banco);
    console.log(`Código de configuração inicial: ${codigo}`);
    console.log(
      `Válido até ${formatarInstanteParaExibicao(expiraEm, FUSO_HORARIO_PADRAO)} (${FUSO_HORARIO_PADRAO}). O código anterior, se havia, deixou de valer.`,
    );
  } finally {
    fecharBanco(banco);
  }
});
