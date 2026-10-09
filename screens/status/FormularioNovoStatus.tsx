'use client';

import { useActionState } from 'react';
import Botao from '@/components/ui/Botao';
import CampoFormulario from '@/components/ui/CampoFormulario';
import CampoMarcacao from '@/components/ui/CampoMarcacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_STATUS } from '@/config/camposFormulario';
import { LIMITES_TEXTO, VALOR_CAMPO_MARCADO } from '@/config/constantes';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import CamposCoresColuna, {
  type AparenciaPadraoColunas,
} from '@/screens/status/CamposCoresColuna';
import { textosStatus } from '@/screens/status/textosStatus';
import { criarStatusFormulario } from '@/servidor/web/acoes/acoesStatus';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { lerValorTexto } from '@/util/FormularioUtils';

type PropriedadesFormularioNovoStatus = {
  credencial: string | null;
  aparenciaPadrao: AparenciaPadraoColunas;
};

export default function FormularioNovoStatus({
  credencial,
  aparenciaPadrao,
}: PropriedadesFormularioNovoStatus) {
  const [estado, acao, pendente] = useActionState(
    criarStatusFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  return (
    <form action={acao} noValidate className="flex flex-col gap-3">
      <CampoCredencial credencial={credencial} />
      <h2 className="text-base font-semibold">{textosStatus.tituloNovo}</h2>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div key={estado.tentativa} className="flex flex-col gap-3">
        <CampoFormulario
          id="novo-status-nome"
          name={CAMPOS_STATUS.NOME}
          rotulo={textosStatus.rotuloNome}
          defaultValue={lerValorTexto(estado.valores, CAMPOS_STATUS.NOME)}
          erros={estado.errosCampos?.nome}
          maxLength={LIMITES_TEXTO.NOME_STATUS}
          autoComplete="off"
          required
        />
        <CampoMarcacao
          id="novo-status-finaliza"
          name={CAMPOS_STATUS.FINALIZA}
          value={VALOR_CAMPO_MARCADO}
          rotulo={textosStatus.rotuloFinaliza}
          dica={textosStatus.dicaFinaliza}
          defaultChecked={
            lerValorTexto(estado.valores, CAMPOS_STATUS.FINALIZA) ===
            VALOR_CAMPO_MARCADO
          }
        />
        <CamposCoresColuna
          nomeColuna={lerValorTexto(estado.valores, CAMPOS_STATUS.NOME) ?? ''}
          corTitulo={
            lerValorTexto(estado.valores, CAMPOS_STATUS.COR_TITULO) || null
          }
          corColuna={
            lerValorTexto(estado.valores, CAMPOS_STATUS.COR_COLUNA) || null
          }
          aparenciaPadrao={aparenciaPadrao}
          erros={estado.errosCampos}
        />
      </div>
      <div>
        <Botao type="submit" disabled={pendente}>
          {pendente ? textosStatus.botaoCriando : textosStatus.botaoCriar}
        </Botao>
      </div>
    </form>
  );
}
