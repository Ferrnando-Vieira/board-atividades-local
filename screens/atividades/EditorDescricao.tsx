'use client';

import {
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Icone, { type NomeIcone } from '@/components/ui/Icone';
import { descreverCampo } from '@/components/ui/EstruturaCampo';
import { ACEITE_CAMPO_IMAGEM } from '@/config/anexos';
import DescricaoFormatada from '@/screens/atividades/DescricaoFormatada';
import {
  formatarSelecao,
  inserirEmLinhasProprias,
  type EdicaoTexto,
  type FormatacaoDescricao,
} from '@/screens/atividades/formatacaoDescricao';
import type { ImagensDescricao } from '@/screens/atividades/imagensDescricao';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import type {
  ImagemAdicionada,
  ResultadoAdicao,
} from '@/screens/atividades/useArquivosPendentes';
import { combinarClasses } from '@/util/ClassesUtils';
import {
  montarMarcacaoImagem,
  montarReferenciaAnexoNovo,
} from '@/util/DescricaoUtils';

type BotaoFormatacao = {
  formatacao: FormatacaoDescricao;
  conteudo: ReactNode;
};

function icone(nome: NomeIcone): ReactNode {
  return <Icone nome={nome} className="size-4" />;
}

const BOTOES_FORMATACAO: readonly BotaoFormatacao[] = [
  { formatacao: 'negrito', conteudo: <span className="font-bold">B</span> },
  {
    formatacao: 'italico',
    conteudo: <span className="font-serif italic">I</span>,
  },
  { formatacao: 'tachado', conteudo: <span className="line-through">S</span> },
  { formatacao: 'titulo', conteudo: <span className="font-semibold">H</span> },
  { formatacao: 'lista', conteudo: icone('lista') },
  { formatacao: 'listaNumerada', conteudo: icone('listaNumerada') },
  { formatacao: 'listaTarefas', conteudo: icone('tarefa') },
  { formatacao: 'citacao', conteudo: icone('citacao') },
  { formatacao: 'codigo', conteudo: icone('codigo') },
  { formatacao: 'blocoCodigo', conteudo: icone('blocoCodigo') },
  { formatacao: 'link', conteudo: icone('link') },
];

const ATALHOS: Readonly<Record<string, FormatacaoDescricao>> = {
  b: 'negrito',
  i: 'italico',
  k: 'link',
  e: 'codigo',
};

const CLASSES_BOTAO_BARRA =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-sm text-texto hover:bg-texto/5 focus-visible:outline-2 focus-visible:outline-primaria';

const CLASSES_ABA =
  'inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primaria';

// execCommand mantém a alteração no desfazer (Ctrl+Z) do navegador; onde
// ele não existir ou não inserir, o texto é trocado direto no campo.
function aplicarNoCampo(campo: HTMLTextAreaElement, edicao: EdicaoTexto): void {
  campo.focus();
  campo.setSelectionRange(edicao.de, edicao.ate);
  const inseriu =
    typeof document.execCommand === 'function' &&
    document.execCommand('insertText', false, edicao.insercao);
  const conferido =
    inseriu &&
    campo.value.slice(edicao.de, edicao.de + edicao.insercao.length) ===
      edicao.insercao;
  if (!conferido) {
    campo.setRangeText(edicao.insercao, edicao.de, edicao.ate, 'end');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }
  campo.setSelectionRange(edicao.selecaoInicio, edicao.selecaoFim);
}

function temArquivos(transferencia: DataTransfer): boolean {
  return Array.from(transferencia.types).includes('Files');
}

type PropriedadesEditorDescricao = {
  id: string;
  name: string;
  rotulo: string;
  defaultValue: string;
  erros?: string[];
  maxLength: number;
  rows: number;
  // Anexos já gravados e imagens coladas ainda não salvas, para a
  // visualização.
  imagens: ImagensDescricao;
  aoAdicionarImagens: (
    arquivos: readonly File[],
  ) => ResultadoAdicao<ImagemAdicionada>;
};

// Campo de descrição em Markdown. O textarea continua sendo o campo do
// formulário (não controlado): a barra só edita o texto dele, e na
// visualização ele fica escondido, mas ainda é enviado.
export default function EditorDescricao({
  id,
  name,
  rotulo,
  defaultValue,
  erros,
  maxLength,
  rows,
  imagens,
  aoAdicionarImagens,
}: PropriedadesEditorDescricao) {
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const seletorImagemRef = useRef<HTMLInputElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const [visualizando, setVisualizando] = useState(false);
  const [textoVisualizado, setTextoVisualizado] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [botaoFocavel, setBotaoFocavel] = useState(0);
  const descricao = descreverCampo(id, textosAtividades.dicaDescricao, erros);
  const idAviso = `${id}-aviso`;

  function lerSelecao(campo: HTMLTextAreaElement) {
    return {
      texto: campo.value,
      inicio: campo.selectionStart,
      fim: campo.selectionEnd,
    };
  }

  function formatar(formatacao: FormatacaoDescricao): void {
    const campo = campoRef.current;
    if (!campo) {
      return;
    }
    aplicarNoCampo(
      campo,
      formatarSelecao(
        lerSelecao(campo),
        formatacao,
        textosAtividades.textoPadraoLink,
      ),
    );
  }

  function inserirImagens(arquivos: readonly File[]): void {
    const campo = campoRef.current;
    if (!campo || arquivos.length === 0) {
      return;
    }
    const resultado = aoAdicionarImagens(arquivos);
    if (!resultado.ok) {
      setAviso(resultado.mensagem);
      return;
    }
    setAviso(null);
    aplicarNoCampo(
      campo,
      inserirEmLinhasProprias(
        lerSelecao(campo),
        resultado.itens.map((imagem) =>
          montarMarcacaoImagem(
            imagem.nome,
            montarReferenciaAnexoNovo(imagem.chave),
          ),
        ),
      ),
    );
  }

  // Texto tem preferência: Excel e Word põem também uma imagem das células
  // na área de transferência, e colar uma tabela não pode virar figura. Sem
  // texto (captura de tela, "copiar imagem"), os arquivos viram imagens.
  function aoColar(evento: ClipboardEvent<HTMLTextAreaElement>): void {
    const arquivos = Array.from(evento.clipboardData.files);
    if (
      arquivos.length === 0 ||
      evento.clipboardData.getData('text/plain').trim() !== ''
    ) {
      return;
    }
    evento.preventDefault();
    inserirImagens(arquivos);
  }

  function aoArrastarSobre(evento: DragEvent<HTMLElement>): void {
    if (!temArquivos(evento.dataTransfer)) {
      return;
    }
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
    setArrastando(true);
  }

  function aoSoltar(evento: DragEvent<HTMLElement>): void {
    setArrastando(false);
    if (!temArquivos(evento.dataTransfer)) {
      return;
    }
    evento.preventDefault();
    inserirImagens(Array.from(evento.dataTransfer.files));
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>): void {
    if (
      !(evento.ctrlKey || evento.metaKey) ||
      evento.altKey ||
      evento.shiftKey
    ) {
      return;
    }
    const formatacao = ATALHOS[evento.key.toLowerCase()];
    if (formatacao) {
      evento.preventDefault();
      formatar(formatacao);
    }
  }

  // Barra de ferramentas com um só ponto de parada no Tab; as setas andam
  // entre os botões (padrão "toolbar" da WAI-ARIA).
  function aoTeclarNaBarra(evento: KeyboardEvent<HTMLDivElement>): void {
    const total = BOTOES_FORMATACAO.length + 1;
    const destinos: Record<string, number> = {
      ArrowRight: (botaoFocavel + 1) % total,
      ArrowLeft: (botaoFocavel - 1 + total) % total,
      Home: 0,
      End: total - 1,
    };
    const destino = destinos[evento.key];
    if (destino === undefined) {
      return;
    }
    evento.preventDefault();
    setBotaoFocavel(destino);
    barraRef.current
      ?.querySelectorAll<HTMLButtonElement>('button')
      [destino]?.focus();
  }

  function alternarVisualizacao(ativar: boolean): void {
    if (ativar) {
      setTextoVisualizado(campoRef.current?.value ?? '');
    }
    setVisualizando(ativar);
  }

  const idsDescricao =
    [descricao.idsDescricao, aviso ? idAviso : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <div
        onDragOver={aoArrastarSobre}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={combinarClasses(
          'relative rounded-xl border bg-superficie transition-colors focus-within:border-primaria focus-within:outline-2 focus-within:outline-primaria',
          descricao.possuiErro ? 'border-erro' : 'border-borda',
          arrastando && 'border-primaria bg-primaria-suave',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-1 rounded-t-xl border-b border-borda bg-fundo/70 px-1.5 py-1">
          <div
            role="group"
            aria-label={textosAtividades.rotuloModoDescricao}
            className="flex gap-1"
          >
            <button
              type="button"
              aria-pressed={!visualizando}
              onClick={() => alternarVisualizacao(false)}
              className={combinarClasses(
                CLASSES_ABA,
                visualizando
                  ? 'text-texto-suave hover:bg-texto/5'
                  : 'bg-superficie text-texto shadow-cartao',
              )}
            >
              {textosAtividades.abaEscrever}
            </button>
            <button
              type="button"
              aria-pressed={visualizando}
              onClick={() => alternarVisualizacao(true)}
              className={combinarClasses(
                CLASSES_ABA,
                visualizando
                  ? 'bg-superficie text-texto shadow-cartao'
                  : 'text-texto-suave hover:bg-texto/5',
              )}
            >
              {textosAtividades.abaVisualizar}
            </button>
          </div>
          {!visualizando && (
            <div
              ref={barraRef}
              role="toolbar"
              aria-label={textosAtividades.rotuloBarraFormatacao}
              aria-controls={id}
              onKeyDown={aoTeclarNaBarra}
              className="flex flex-wrap items-center gap-0.5"
            >
              {BOTOES_FORMATACAO.map((botao, indice) => (
                <button
                  key={botao.formatacao}
                  type="button"
                  tabIndex={indice === botaoFocavel ? 0 : -1}
                  title={textosAtividades.formatacoes[botao.formatacao]}
                  aria-label={textosAtividades.formatacoes[botao.formatacao]}
                  // Sem isto o clique tiraria o foco (e a seleção) do campo.
                  onMouseDown={(evento) => evento.preventDefault()}
                  onFocus={() => setBotaoFocavel(indice)}
                  onClick={() => formatar(botao.formatacao)}
                  className={CLASSES_BOTAO_BARRA}
                >
                  {botao.conteudo}
                </button>
              ))}
              <button
                type="button"
                tabIndex={botaoFocavel === BOTOES_FORMATACAO.length ? 0 : -1}
                title={textosAtividades.inserirImagem}
                aria-label={textosAtividades.inserirImagem}
                onMouseDown={(evento) => evento.preventDefault()}
                onFocus={() => setBotaoFocavel(BOTOES_FORMATACAO.length)}
                onClick={() => seletorImagemRef.current?.click()}
                className={CLASSES_BOTAO_BARRA}
              >
                <Icone nome="imagem" className="size-4" />
              </button>
            </div>
          )}
        </div>
        <textarea
          ref={campoRef}
          id={id}
          name={name}
          defaultValue={defaultValue}
          maxLength={maxLength}
          rows={rows}
          hidden={visualizando}
          onPaste={aoColar}
          onKeyDown={aoTeclar}
          aria-invalid={descricao.possuiErro}
          aria-describedby={idsDescricao}
          className="block min-h-36 w-full resize-y rounded-b-xl bg-transparent px-3 py-2 text-base text-texto focus:outline-none"
        />
        {visualizando && (
          <div className="min-h-36 px-3 py-2">
            {textoVisualizado.trim() === '' ? (
              <p className="text-sm text-texto-suave">
                {textosAtividades.visualizacaoVazia}
              </p>
            ) : (
              <DescricaoFormatada texto={textoVisualizado} imagens={imagens} />
            )}
          </div>
        )}
        {arrastando && (
          <p
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-sm font-semibold text-primaria"
          >
            {textosAtividades.soltarImagensAqui}
          </p>
        )}
        <input
          ref={seletorImagemRef}
          type="file"
          accept={ACEITE_CAMPO_IMAGEM}
          multiple
          hidden
          tabIndex={-1}
          onChange={(evento) => {
            const arquivos = Array.from(evento.currentTarget.files ?? []);
            evento.currentTarget.value = '';
            inserirImagens(arquivos);
          }}
        />
      </div>
      <p id={descricao.idDica} className="text-xs text-texto-suave">
        {textosAtividades.dicaDescricao}
      </p>
      {aviso && (
        <p id={idAviso} role="alert" className="text-xs text-erro">
          {aviso}
        </p>
      )}
      {descricao.possuiErro && (
        <p id={descricao.idErro} className="text-xs text-erro">
          {erros?.join(' ')}
        </p>
      )}
    </div>
  );
}
