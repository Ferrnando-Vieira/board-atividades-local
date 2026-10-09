'use client';

import {
  useActionState,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import Botao from '@/components/ui/Botao';
import {
  classesControle,
  descreverCampo,
} from '@/components/ui/EstruturaCampo';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { ACEITE_CAMPO_ANEXO, LIMITES_ANEXO } from '@/config/anexos';
import { CAMPOS_ANEXO } from '@/config/camposFormulario';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { mensagensAnexos } from '@/servidor/anexos/mensagensAnexos';
import { enviarAnexoFormulario } from '@/servidor/web/acoes/acoesAnexos';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { formatarTamanhoArquivo } from '@/util/ArquivoUtils';
import { combinarClasses } from '@/util/ClassesUtils';

type PropriedadesFormularioEnvioAnexo = {
  atividadeId: number;
  credencial: string | null;
};

const DICA_NOVO_ANEXO = textosAtividades.dicaNovoAnexo(
  formatarTamanhoArquivo(LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES),
  LIMITES_ANEXO.MAXIMO_POR_ATIVIDADE,
  LIMITES_ANEXO.MAXIMO_POR_ENVIO,
);

// A conferência aqui só evita enviar o que o servidor recusaria (e que
// poderia passar do limite de corpo da Server Action); a validação que vale
// é a do servidor.
function conferirArquivos(arquivos: readonly File[]): string | null {
  if (arquivos.length > LIMITES_ANEXO.MAXIMO_POR_ENVIO) {
    return mensagensAnexos.arquivosDemais;
  }
  if (
    arquivos.some(
      (arquivo) => arquivo.size > LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES,
    )
  ) {
    return mensagensAnexos.arquivoGrande;
  }
  const total = arquivos.reduce((soma, arquivo) => soma + arquivo.size, 0);
  return total > LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES
    ? mensagensAnexos.envioGrande
    : null;
}

// Um ou vários arquivos de uma vez, pelo seletor ou arrastados sobre o
// formulário. Depois da resposta o React reinicia o formulário, então o
// campo de arquivo volta vazio.
export default function FormularioEnvioAnexo({
  atividadeId,
  credencial,
}: PropriedadesFormularioEnvioAnexo) {
  const [estado, acao, pendente] = useActionState(
    enviarAnexoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);
  const idCampo = useId();
  const descricao = descreverCampo(
    idCampo,
    DICA_NOVO_ANEXO,
    erroLocal ? [erroLocal] : undefined,
  );

  function aoEscolher(evento: ChangeEvent<HTMLInputElement>): void {
    const erro = conferirArquivos(Array.from(evento.currentTarget.files ?? []));
    setErroLocal(erro);
    if (erro) {
      evento.currentTarget.value = '';
    }
  }

  function aoArrastarSobre(evento: DragEvent<HTMLFormElement>): void {
    if (pendente || !Array.from(evento.dataTransfer.types).includes('Files')) {
      return;
    }
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
    setArrastando(true);
  }

  // Os arquivos soltos entram no próprio campo, então o envio é o mesmo do
  // seletor.
  function aoSoltar(evento: DragEvent<HTMLFormElement>): void {
    setArrastando(false);
    const campo = campoRef.current;
    if (pendente || !campo || evento.dataTransfer.files.length === 0) {
      return;
    }
    evento.preventDefault();
    const erro = conferirArquivos(Array.from(evento.dataTransfer.files));
    setErroLocal(erro);
    if (!erro) {
      campo.files = evento.dataTransfer.files;
    }
  }

  return (
    <form
      action={acao}
      onDragOver={aoArrastarSobre}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
      className={combinarClasses(
        'flex flex-col gap-2 rounded-lg border p-3 transition-colors',
        arrastando
          ? 'border-primaria bg-primaria-suave'
          : 'border-dashed border-borda',
      )}
    >
      <CampoCredencial credencial={credencial} />
      <input
        type="hidden"
        name={CAMPOS_ANEXO.ATIVIDADE_ID}
        value={atividadeId}
      />
      <label htmlFor={idCampo} className="text-sm font-medium">
        {arrastando
          ? textosAtividades.soltarArquivosAqui
          : textosAtividades.rotuloNovoAnexo}
      </label>
      <input
        ref={campoRef}
        id={idCampo}
        type="file"
        name={CAMPOS_ANEXO.ARQUIVO}
        accept={ACEITE_CAMPO_ANEXO}
        multiple
        required
        disabled={pendente}
        onChange={aoEscolher}
        aria-describedby={descricao.idsDescricao}
        aria-invalid={descricao.possuiErro || undefined}
        className={classesControle(
          descricao.possuiErro,
          'min-h-11 w-full py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-fundo file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-texto',
        )}
      />
      <p id={descricao.idDica} className="text-xs text-texto-suave">
        {DICA_NOVO_ANEXO}
      </p>
      {erroLocal && (
        <p id={descricao.idErro} className="text-xs text-erro">
          {erroLocal}
        </p>
      )}
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div>
        <Botao type="submit" disabled={pendente}>
          {pendente
            ? textosAtividades.enviandoAnexo
            : textosAtividades.botaoEnviarAnexo}
        </Botao>
      </div>
    </form>
  );
}
