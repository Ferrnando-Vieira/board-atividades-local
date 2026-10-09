import {
  restaurarBackup,
  verificarBackup,
} from '@/servidor/backup/backupServico';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import {
  carregarAmbiente,
  executarScript,
  resolverCaminhoInformado,
} from './suporte/suporteScripts';

const OPCAO_CONFIRMAR = '--confirmar';

// Sem --confirmar só confere o backup e mostra o que seria feito; com ele,
// o estado atual é guardado ao lado do banco antes da troca.
executarScript(() => {
  const argumentos = process.argv.slice(2);
  const informado = argumentos.find(
    (argumento) => argumento !== OPCAO_CONFIRMAR,
  );
  if (!informado) {
    throw new ErroApp(
      'Uso: npm run backup:restaurar -- <pasta-do-backup> --confirmar',
      { status: STATUS_ERRO.REQUISICAO_INVALIDA, codigo: 'uso-incorreto' },
    );
  }
  const ambiente = carregarAmbiente();
  const diretorioBackup = resolverCaminhoInformado(informado);
  if (!argumentos.includes(OPCAO_CONFIRMAR)) {
    const manifesto = verificarBackup(diretorioBackup);
    console.log(`Backup válido, criado em ${manifesto.criadoEm}.`);
    console.log(`Seria restaurado em: ${ambiente.caminhoBancoSqlite}`);
    console.log(`Anexos em: ${ambiente.diretorioAnexos}`);
    console.log(
      `Nada foi alterado. Pare o servidor e repita com ${OPCAO_CONFIRMAR}.`,
    );
    return;
  }
  const resultado = restaurarBackup({
    diretorioBackup,
    caminhoBanco: ambiente.caminhoBancoSqlite,
    diretorioAnexos: ambiente.diretorioAnexos,
  });
  console.log(`Backup restaurado em: ${ambiente.caminhoBancoSqlite}`);
  console.log(
    resultado.diretorioEstadoAnterior
      ? `O estado anterior foi guardado em: ${resultado.diretorioEstadoAnterior} (apague depois de conferir o board).`
      : 'Não havia banco nem anexos anteriores no destino.',
  );
  if (resultado.migracoesPendentes > 0) {
    console.log(
      `O backup tem ${resultado.migracoesPendentes} migração(ões) pendente(s): execute "npm run db:migrar" antes de iniciar o servidor.`,
    );
  }
});
