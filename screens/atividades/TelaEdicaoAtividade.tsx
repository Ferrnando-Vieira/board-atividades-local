import { notFound } from 'next/navigation';
import Cartao from '@/components/ui/Cartao';
import LinkBotao from '@/components/ui/LinkBotao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { montarRotaAtividade } from '@/config/rotas';
import FormularioAtividade from '@/screens/atividades/FormularioAtividade';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { montarValoresEdicaoAtividade } from '@/screens/atividades/valoresFormularioAtividade';
import {
  consultarDetalheAtividade,
  consultarOpcoesFormularioAtividade,
} from '@/servidor/atividades/consultasAtividades';
import { editarAtividadeFormulario } from '@/servidor/web/acoes/acoesAtividades';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';

type PropriedadesTelaEdicaoAtividade = {
  acesso: AcessoPainel;
  atividadeId: number;
};

export default function TelaEdicaoAtividade({
  acesso,
  atividadeId,
}: PropriedadesTelaEdicaoAtividade) {
  const banco = obterBancoAplicacao();
  const consulta = consultarDetalheAtividade(
    banco,
    atividadeId,
    new Date(),
    acesso.restricao,
  );
  const opcoes = consultarOpcoesFormularioAtividade(banco);
  if (!consulta || !opcoes) {
    notFound();
  }
  const { atividade } = consulta;
  const rotaDetalhe = montarRotaAtividade(atividade.id, acesso.prefixoRotas);
  return (
    <Cartao className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{textosAtividades.tituloEdicao}</h1>
      {atividade.arquivadaEm ? (
        <>
          <MensagemAlerta tipo="aviso">
            {textosAtividades.atividadeArquivada}
          </MensagemAlerta>
          <LinkBotao href={rotaDetalhe}>{textosAtividades.cancelar}</LinkBotao>
        </>
      ) : (
        <FormularioAtividade
          modo="edicao"
          acao={editarAtividadeFormulario}
          valoresIniciais={montarValoresEdicaoAtividade(atividade)}
          opcoes={opcoes}
          rotaCancelar={rotaDetalhe}
          credencial={acesso.tokenCompartilhamento}
          identificacao={{
            atividadeId: atividade.id,
            versao: atividade.versao,
          }}
        />
      )}
    </Cartao>
  );
}
