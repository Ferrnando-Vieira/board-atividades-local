import Cartao from '@/components/ui/Cartao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { aplicarPrefixo, ROTAS } from '@/config/rotas';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';
import FormularioAtividade from '@/screens/atividades/FormularioAtividade';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { montarValoresNovaAtividade } from '@/screens/atividades/valoresFormularioAtividade';
import { consultarOpcoesFormularioAtividade } from '@/servidor/atividades/consultasAtividades';
import { criarAtividadeFormulario } from '@/servidor/web/acoes/acoesAtividades';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';

type PropriedadesTelaNovaAtividade = {
  acesso: AcessoPainel;
  statusSugeridoId: number | null;
};

export default function TelaNovaAtividade({
  acesso,
  statusSugeridoId,
}: PropriedadesTelaNovaAtividade) {
  const opcoes = consultarOpcoesFormularioAtividade(
    obterBancoAplicacao(),
    acesso.solicitantePadrao,
  );
  const statusInicial =
    opcoes?.status.find((status) => status.id === statusSugeridoId) ??
    opcoes?.status[0];
  if (!opcoes || !statusInicial) {
    return (
      <MensagemAlerta tipo="aviso">
        {textosAplicacao.boardAusente}
      </MensagemAlerta>
    );
  }
  return (
    <Cartao className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{textosAtividades.tituloNova}</h1>
        <p className="text-sm text-texto-suave">
          {textosAtividades.descricaoNova}
        </p>
      </header>
      <FormularioAtividade
        modo="criacao"
        acao={criarAtividadeFormulario}
        valoresIniciais={montarValoresNovaAtividade(
          statusInicial.id,
          opcoes.solicitantePadrao,
        )}
        opcoes={opcoes}
        rotaCancelar={aplicarPrefixo(acesso.prefixoRotas, ROTAS.INICIO)}
        credencial={acesso.tokenCompartilhamento}
      />
    </Cartao>
  );
}
