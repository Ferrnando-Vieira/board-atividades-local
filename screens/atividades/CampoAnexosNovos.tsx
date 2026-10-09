'use client';

import { useId, useRef, useState, type DragEvent } from 'react';
import Botao from '@/components/ui/Botao';
import Icone from '@/components/ui/Icone';
import { ACEITE_CAMPO_ANEXO, LIMITES_ANEXO } from '@/config/anexos';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import type {
  ArquivoNaTela,
  ResultadoAdicao,
} from '@/screens/atividades/useArquivosPendentes';
import { formatarTamanhoArquivo } from '@/util/ArquivoUtils';
import { combinarClasses } from '@/util/ClassesUtils';

type PropriedadesCampoAnexosNovos = {
  anexos: readonly ArquivoNaTela[];
  aoAdicionar: (arquivos: readonly File[]) => ResultadoAdicao<ArquivoNaTela>;
  aoRemover: (id: string) => void;
};

const DICA_ANEXOS_NOVOS = textosAtividades.dicaAnexosNovos(
  formatarTamanhoArquivo(LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES),
  LIMITES_ANEXO.MAXIMO_POR_ENVIO,
);

// Na criação ainda não há atividade para receber anexos: os arquivos ficam
// na tela e vão com o formulário. O seletor não tem `name`, então só a lista
// abaixo (montada no envio) chega ao servidor.
export default function CampoAnexosNovos({
  anexos,
  aoAdicionar,
  aoRemover,
}: PropriedadesCampoAnexosNovos) {
  const seletorRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const idTitulo = useId();
  const idDica = useId();
  const idErro = useId();

  function adicionar(arquivos: readonly File[]): void {
    if (arquivos.length === 0) {
      return;
    }
    const resultado = aoAdicionar(arquivos);
    setErro(resultado.ok ? null : resultado.mensagem);
  }

  function aoArrastarSobre(evento: DragEvent<HTMLElement>): void {
    if (!Array.from(evento.dataTransfer.types).includes('Files')) {
      return;
    }
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
    setArrastando(true);
  }

  function aoSoltar(evento: DragEvent<HTMLElement>): void {
    setArrastando(false);
    if (evento.dataTransfer.files.length === 0) {
      return;
    }
    evento.preventDefault();
    adicionar(Array.from(evento.dataTransfer.files));
  }

  return (
    <fieldset
      aria-describedby={[idDica, erro ? idErro : null]
        .filter(Boolean)
        .join(' ')}
      onDragOver={aoArrastarSobre}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
      className={combinarClasses(
        'flex flex-col gap-3 rounded-lg border p-3 transition-colors',
        arrastando
          ? 'border-primaria bg-primaria-suave'
          : 'border-dashed border-borda',
      )}
    >
      <legend id={idTitulo} className="px-1 text-sm font-semibold">
        {textosAtividades.rotuloAnexosNovos}
      </legend>
      {anexos.length > 0 && (
        <ul
          aria-labelledby={idTitulo}
          className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie"
        >
          {anexos.map((anexo) => (
            <li
              key={anexo.id}
              className="flex items-center justify-between gap-2 px-3 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Icone nome="clipe" className="text-texto-suave" />
                <span className="break-all">{anexo.arquivo.name}</span>
                <span className="shrink-0 text-xs text-texto-suave">
                  {formatarTamanhoArquivo(anexo.arquivo.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => aoRemover(anexo.id)}
                aria-label={textosAtividades.removerAnexoPendente(
                  anexo.arquivo.name,
                )}
                className="inline-flex min-h-9 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-texto-suave hover:bg-texto/5 hover:text-texto focus-visible:outline-2 focus-visible:outline-primaria"
              >
                {textosAtividades.tirarDaLista}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Botao
          variante="secundario"
          onClick={() => seletorRef.current?.click()}
        >
          <Icone nome="clipe" />
          {textosAtividades.botaoEscolherAnexos}
        </Botao>
        {arrastando && (
          <span className="text-sm font-semibold text-primaria">
            {textosAtividades.soltarArquivosAqui}
          </span>
        )}
      </div>
      <input
        ref={seletorRef}
        type="file"
        accept={ACEITE_CAMPO_ANEXO}
        multiple
        hidden
        tabIndex={-1}
        onChange={(evento) => {
          const arquivos = Array.from(evento.currentTarget.files ?? []);
          evento.currentTarget.value = '';
          adicionar(arquivos);
        }}
      />
      <p id={idDica} className="text-xs text-texto-suave">
        {DICA_ANEXOS_NOVOS}
      </p>
      {erro && (
        <p id={idErro} role="alert" className="text-xs text-erro">
          {erro}
        </p>
      )}
    </fieldset>
  );
}
