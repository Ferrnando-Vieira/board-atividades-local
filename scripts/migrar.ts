import { abrirBanco, fecharBanco } from '@/servidor/banco/conexao';
import {
  aplicarMigracoes,
  contarMigracoesAplicadas,
} from '@/servidor/banco/migrador';
import { carregarAmbiente, executarScript } from './suporte/suporteScripts';

executarScript(() => {
  const ambiente = carregarAmbiente();
  const banco = abrirBanco(ambiente.caminhoBancoSqlite);
  try {
    const antes = contarMigracoesAplicadas(banco);
    aplicarMigracoes(banco);
    const depois = contarMigracoesAplicadas(banco);
    console.log(`Banco: ${ambiente.caminhoBancoSqlite}`);
    console.log(
      `Migrações aplicadas agora: ${depois - antes}. Total registrado: ${depois}.`,
    );
  } finally {
    fecharBanco(banco);
  }
});
