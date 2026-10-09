import fs from 'node:fs';
import type { Ambiente } from '@/config/ambiente';
import { FUSO_HORARIO_PADRAO } from '@/config/constantes';
import {
  emitirCodigoConfiguracao,
  existeAdministrador,
} from '@/servidor/administracao/configuracaoInicial';
import {
  abrirBanco,
  fecharBanco,
  type BancoDados,
} from '@/servidor/banco/conexao';
import {
  aplicarMigracoes,
  contarMigracoesAplicadas,
} from '@/servidor/banco/migrador';
import { garantirBoardPadrao } from '@/servidor/board/boardRepositorio';
import { formatarInstanteParaExibicao } from '@/util/DataUtils';

function exibirCodigoConfiguracao(banco: BancoDados): void {
  if (existeAdministrador(banco)) {
    console.log('Conta administrativa: já configurada.');
    return;
  }
  const { codigo, expiraEm } = emitirCodigoConfiguracao(banco);
  console.log('Conta administrativa: pendente.');
  console.log(`Código de configuração inicial: ${codigo}`);
  console.log(
    `Válido até ${formatarInstanteParaExibicao(expiraEm, FUSO_HORARIO_PADRAO)} (${FUSO_HORARIO_PADRAO}). Use-o em /configuracao-inicial; um novo código invalida o anterior.`,
  );
}

// Usada por "inicializar" e por "resetar-board": cria o que faltar (banco,
// migrações, board padrão) e mostra o código da configuração inicial se a
// conta administrativa ainda não existe. O board nasce vazio: o solicitante
// padrão é informado na configuração inicial.
export function inicializarBanco(ambiente: Ambiente): void {
  fs.mkdirSync(ambiente.diretorioAnexos, { recursive: true });
  const banco = abrirBanco(ambiente.caminhoBancoSqlite);
  try {
    aplicarMigracoes(banco);
    const board = garantirBoardPadrao(banco);
    console.log(`Banco: ${ambiente.caminhoBancoSqlite}`);
    console.log(`Diretório de anexos: ${ambiente.diretorioAnexos}`);
    console.log(`Migrações registradas: ${contarMigracoesAplicadas(banco)}`);
    console.log(
      board.boardCriado
        ? `Board criado com ${board.statusCriados} status iniciais e sem atividades.`
        : 'Board já existia; nada foi recriado.',
    );
    exibirCodigoConfiguracao(banco);
  } finally {
    fecharBanco(banco);
  }
}
