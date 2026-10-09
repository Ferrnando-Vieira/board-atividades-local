import type { BancoDados } from '@/servidor/banco/conexao';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  definirSolicitantePadrao,
  garantirSolicitante,
  type RegistroGarantido,
} from '@/servidor/classificacao/classificacaoRepositorio';
import type { DadosNovoSolicitante } from '@/servidor/classificacao/esquemasSolicitantes';

// Mesmo cadastro normalizado usado ao salvar uma atividade: repetir o nome,
// com outra caixa ou sem acento, devolve o registro existente.
export function registrarSolicitante(
  banco: BancoDados,
  dados: DadosNovoSolicitante,
): RegistroGarantido {
  return banco.transaction(
    (transacao) =>
      garantirSolicitante(
        transacao,
        exigirBoardPadrao(transacao).id,
        dados.nome,
      ),
    { behavior: 'immediate' },
  );
}

// Um nome ainda sem cadastro é cadastrado; o padrão anterior continua
// existindo, só deixa de ser o padrão.
export function alterarSolicitantePadrao(
  banco: BancoDados,
  dados: DadosNovoSolicitante,
): RegistroGarantido {
  return banco.transaction(
    (transacao) =>
      definirSolicitantePadrao(
        transacao,
        exigirBoardPadrao(transacao).id,
        dados.nome,
      ),
    { behavior: 'immediate' },
  );
}
