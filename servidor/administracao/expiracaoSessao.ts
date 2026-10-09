import { SESSAO_ADMINISTRATIVA } from '@/config/constantesSeguranca';
import { somarDias } from '@/util/DataUtils';

// Fora de sessoes.ts para o proxy (que renova o cookie) calcular a mesma
// validade sem carregar o banco.
export function calcularExpiracaoSessao(agora: Date): string {
  return somarDias(agora, SESSAO_ADMINISTRATIVA.DURACAO_DIAS).toISOString();
}
