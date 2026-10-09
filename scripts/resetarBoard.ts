import { createInterface } from 'node:readline/promises';
import {
  apagarDadosBoard,
  listarAlvosReset,
} from '@/servidor/backup/resetBoard';
import { resolverCaminhoChaveLinks } from '@/servidor/compartilhamento/chaveLinks';
import { inicializarBanco } from './suporte/inicializacaoBanco';
import { carregarAmbiente, executarScript } from './suporte/suporteScripts';

const OPCAO_CONFIRMAR = '--confirmar';
const PALAVRA_CONFIRMACAO = 'RESETAR';

async function confirmar(): Promise<boolean> {
  if (process.argv.slice(2).includes(OPCAO_CONFIRMAR)) {
    return true;
  }
  if (!process.stdin.isTTY) {
    console.log(
      `Sem terminal interativo para confirmar: repita com "npm run resetar-board -- ${OPCAO_CONFIRMAR}".`,
    );
    return false;
  }
  const leitor = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const resposta = await leitor.question(
      `Digite ${PALAVRA_CONFIRMACAO} para apagar tudo: `,
    );
    return resposta.trim() === PALAVRA_CONFIRMACAO;
  } finally {
    leitor.close();
  }
}

// Volta o board ao estado de fábrica: apaga atividades, tags, solicitantes,
// lembretes, anexos, aparência, a conta administrativa, os tokens da API
// (o MCP deixa de funcionar) e os links de compartilhamento. Os backups em
// dados/backups ficam. Exige o servidor parado.
executarScript(async () => {
  const ambiente = carregarAmbiente();
  const opcoes = {
    caminhoBanco: ambiente.caminhoBancoSqlite,
    diretorioAnexos: ambiente.diretorioAnexos,
    caminhoChaveLinks: resolverCaminhoChaveLinks(ambiente.caminhoBancoSqlite),
  };
  console.log('O reset apaga, sem backup:');
  for (const alvo of listarAlvosReset(opcoes)) {
    console.log(`  - ${alvo}`);
  }
  console.log(
    'Isso inclui a conta administrativa, os tokens da API (o MCP para de funcionar) e os links de compartilhamento.',
  );
  if (!(await confirmar())) {
    console.log('Reset cancelado; nada foi apagado.');
    return;
  }
  const apagados = apagarDadosBoard(opcoes);
  console.log(
    apagados.length > 0
      ? `Apagado(s): ${apagados.length} item(ns).`
      : 'Não havia dados para apagar.',
  );
  inicializarBanco(ambiente);
  console.log(
    'Board resetado. Inicie o servidor, conclua a configuração inicial e gere um novo token em Integrações para o MCP.',
  );
});
