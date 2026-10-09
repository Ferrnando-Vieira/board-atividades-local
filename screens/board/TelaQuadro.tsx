import MensagemAlerta from '@/components/ui/MensagemAlerta';
import type { Aviso } from '@/config/rotas';
import AvisoSucesso from '@/screens/aplicacao/AvisoSucesso';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';
import QuadroKanban from '@/screens/board/QuadroKanban';
import { textosBoard } from '@/screens/board/textosBoard';
import FormularioBusca from '@/screens/busca/FormularioBusca';
import SecaoCompartilhamento from '@/screens/compartilhamento/SecaoCompartilhamento';
import { consultarOpcoesFormularioAtividade } from '@/servidor/atividades/consultasAtividades';
import { montarAparenciaPainel } from '@/servidor/board/aparenciaBoard';
import { consultarQuadro } from '@/servidor/board/consultaQuadro';
import {
  extrairContextoNavegacao,
  type AcessoPainel,
} from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';

type PropriedadesTelaQuadro = {
  acesso: AcessoPainel;
  aviso: Aviso | null;
};

// O nome do board já aparece no cabeçalho da aplicação; aqui o título fica
// só para leitores de tela. As opções do formulário (status, solicitantes e
// tags) vão ao navegador apenas para quem pode criar e editar.
export default function TelaQuadro({ acesso, aviso }: PropriedadesTelaQuadro) {
  const banco = obterBancoAplicacao();
  const quadro = consultarQuadro(banco, new Date(), acesso.restricao);
  if (!quadro) {
    return (
      <MensagemAlerta tipo="aviso">
        {textosAplicacao.boardAusente}
      </MensagemAlerta>
    );
  }
  const opcoesFormulario = acesso.permiteGestao
    ? consultarOpcoesFormularioAtividade(banco)
    : null;
  const { superficies, amostrasFundo } = montarAparenciaPainel(
    banco,
    acesso.prefixoRotas,
  );
  return (
    <div className="flex flex-col gap-3 md:min-h-0 md:flex-1">
      <h1 className="sr-only">{textosBoard.tituloOculto(quadro.nomeBoard)}</h1>
      <AvisoSucesso aviso={aviso} />
      <QuadroKanban
        quadro={quadro}
        contexto={extrairContextoNavegacao(acesso)}
        aparencia={{ superficies, amostrasFundo }}
        opcoesFormulario={opcoesFormulario}
        acoesCabecalho={
          <>
            <FormularioBusca
              prefixoRotas={acesso.prefixoRotas}
              termo=""
              atalhoQuadro
            />
            {acesso.permiteAdministracao && <SecaoCompartilhamento />}
          </>
        }
      />
    </div>
  );
}
