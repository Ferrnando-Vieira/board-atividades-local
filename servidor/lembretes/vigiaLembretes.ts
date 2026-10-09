import { LEMBRETES } from '@/config/constantes';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  coletarAvisosSistema,
  type AvisoSistema,
} from '@/servidor/lembretes/avisosSistema';

const MILISSEGUNDOS_POR_SEGUNDO = 1000;

export type DependenciasVigia = {
  abrirBanco: () => BancoDados;
  exibirAviso: (aviso: AvisoSistema) => Promise<boolean>;
  urlBase: string;
  aoFalhar: (erro: unknown) => void;
};

// Um ciclo abre o banco, dispara o que venceu e fecha: o servidor sobe antes
// do banco existir ou das migrações, e um ciclo que falha (banco ausente,
// migração pendente) não impede o seguinte.
export async function executarCicloVigia(
  dependencias: DependenciasVigia,
  agora: Date = new Date(),
): Promise<number> {
  let avisos: AvisoSistema[];
  const banco = dependencias.abrirBanco();
  try {
    avisos = coletarAvisosSistema(banco, dependencias.urlBase, agora);
  } finally {
    fecharBanco(banco);
  }
  for (const aviso of avisos) {
    await dependencias.exibirAviso(aviso);
  }
  return avisos.length;
}

// Verifica os lembretes em intervalos, com o navegador aberto ou não. Devolve
// a função que encerra a vigilância.
export function iniciarVigiaLembretes(
  dependencias: DependenciasVigia,
): () => void {
  let emAndamento = false;
  let ultimaFalha: string | null = null;

  async function verificar(): Promise<void> {
    if (emAndamento) {
      return;
    }
    emAndamento = true;
    try {
      await executarCicloVigia(dependencias);
      ultimaFalha = null;
    } catch (erro) {
      // Repete a mesma falha só uma vez, para não encher o terminal.
      const descricao = erro instanceof Error ? erro.message : String(erro);
      if (descricao !== ultimaFalha) {
        ultimaFalha = descricao;
        dependencias.aoFalhar(erro);
      }
    } finally {
      emAndamento = false;
    }
  }

  void verificar();
  const intervalo = setInterval(
    () => void verificar(),
    LEMBRETES.INTERVALO_VIGIA_SEGUNDOS * MILISSEGUNDOS_POR_SEGUNDO,
  );
  return () => clearInterval(intervalo);
}
