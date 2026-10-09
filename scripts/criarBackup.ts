import path from 'node:path';
import { criarBackup } from '@/servidor/backup/backupServico';
import { formatarTamanhoArquivo } from '@/util/ArquivoUtils';
import {
  carregarAmbiente,
  executarScript,
  resolverCaminhoInformado,
} from './suporte/suporteScripts';

const DIRETORIO_BACKUPS_PADRAO = 'backups';

// Sem destino informado, o backup fica ao lado do banco (pasta ignorada pelo
// Git); copie a pasta gerada para outro disco para se proteger de falha nele.
executarScript(async () => {
  const ambiente = carregarAmbiente();
  const destinoInformado = process.argv[2];
  const diretorioDestino = destinoInformado
    ? resolverCaminhoInformado(destinoInformado)
    : path.join(
        path.dirname(ambiente.caminhoBancoSqlite),
        DIRETORIO_BACKUPS_PADRAO,
      );
  const { diretorio, manifesto } = await criarBackup({
    caminhoBanco: ambiente.caminhoBancoSqlite,
    diretorioAnexos: ambiente.diretorioAnexos,
    diretorioDestino,
  });
  console.log(`Backup criado em: ${diretorio}`);
  console.log(
    `Banco: ${formatarTamanhoArquivo(manifesto.banco.tamanhoBytes)}, ${manifesto.migracoesAplicadas} migrações, SHA-256 ${manifesto.banco.sha256}.`,
  );
  console.log(
    `Anexos copiados e conferidos: ${manifesto.anexos.quantidade} (${formatarTamanhoArquivo(manifesto.anexos.tamanhoBytes)}).`,
  );
  console.log(
    'Confira a cópia em outra mídia com "npm run backup:verificar -- <pasta>".',
  );
});
