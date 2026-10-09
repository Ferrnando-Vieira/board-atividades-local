import { LIMITES_ANEXO } from '@/config/anexos';
import { reconciliarArquivosAnexos } from '@/servidor/anexos/anexosServico';
import { fecharBanco } from '@/servidor/banco/conexao';
import {
  abrirBancoInicializado,
  carregarAmbiente,
  executarScript,
} from './suporte/suporteScripts';

// Pode rodar com o servidor no ar: só apaga arquivos sem anexo ativo e mais
// velhos que a idade mínima, então um envio em andamento não é alcançado.
executarScript(() => {
  const ambiente = carregarAmbiente();
  const banco = abrirBancoInicializado(ambiente);
  try {
    const resultado = reconciliarArquivosAnexos(
      banco,
      ambiente.diretorioAnexos,
    );
    console.log(`Diretório de anexos: ${ambiente.diretorioAnexos}`);
    console.log(
      `Arquivos verificados: ${resultado.arquivosVerificados}. Órfãos com mais de ${LIMITES_ANEXO.IDADE_MINIMA_ORFAO_MINUTOS} minutos removidos: ${resultado.orfaosRemovidos}.`,
    );
  } finally {
    fecharBanco(banco);
  }
});
