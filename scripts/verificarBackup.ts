import { verificarBackup } from '@/servidor/backup/backupServico';
import { formatarTamanhoArquivo } from '@/util/ArquivoUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import {
  executarScript,
  resolverCaminhoInformado,
} from './suporte/suporteScripts';

executarScript(() => {
  const informado = process.argv[2];
  if (!informado) {
    throw new ErroApp('Uso: npm run backup:verificar -- <pasta-do-backup>', {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: 'uso-incorreto',
    });
  }
  const diretorio = resolverCaminhoInformado(informado);
  const manifesto = verificarBackup(diretorio);
  console.log(`Backup válido: ${diretorio}`);
  console.log(
    `Criado em ${manifesto.criadoEm}; ${manifesto.migracoesAplicadas} migrações; integridade e chaves estrangeiras ok.`,
  );
  console.log(
    `Anexos conferidos por SHA-256: ${manifesto.anexos.quantidade} (${formatarTamanhoArquivo(manifesto.anexos.tamanhoBytes)}).`,
  );
});
