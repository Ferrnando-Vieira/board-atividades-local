'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import Botao from '@/components/ui/Botao';
import {
  classesControle,
  descreverCampo,
} from '@/components/ui/EstruturaCampo';
import { LIMITES_COLECAO, LIMITES_TEXTO } from '@/config/constantes';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import {
  gerarChaveNormalizada,
  removerNomesRepetidos,
} from '@/util/NormalizacaoUtils';

const TECLAS_CONFIRMAR_TAG = new Set(['Enter', ',']);
const SEPARADOR_TAGS = ',';

type PropriedadesCampoTags = {
  id: string;
  nome: string;
  valoresIniciais: readonly string[];
  sugestoes: readonly string[];
  erros?: string[];
  // Avisado a cada inclusão ou remoção, com as tags na ordem em que foram
  // adicionadas.
  aoAlterar?: (tags: string[]) => void;
};

// As tags escolhidas viram campos ocultos com o mesmo nome; o servidor
// normaliza de novo, então a deduplicação aqui é só para o que se vê na tela.
export default function CampoTags({
  id,
  nome,
  valoresIniciais,
  sugestoes,
  erros,
  aoAlterar,
}: PropriedadesCampoTags) {
  const [tags, setTagsInternas] = useState(() =>
    removerNomesRepetidos(valoresIniciais),
  );
  const setTags = (novas: string[]) => {
    setTagsInternas(novas);
    aoAlterar?.(novas);
  };
  const [texto, setTexto] = useState('');
  const idLista = useId();
  const descricao = descreverCampo(id, textosAtividades.dicaTags, erros);
  const chavesEscolhidas = new Set(tags.map(gerarChaveNormalizada));
  const sugestoesDisponiveis = sugestoes.filter(
    (sugestao) => !chavesEscolhidas.has(gerarChaveNormalizada(sugestao)),
  );
  const limiteAtingido = tags.length >= LIMITES_COLECAO.TAGS_POR_ATIVIDADE;

  function adicionar(): void {
    if (texto.trim() === '') {
      return;
    }
    setTags(
      removerNomesRepetidos([...tags, ...texto.split(SEPARADOR_TAGS)]).slice(
        0,
        LIMITES_COLECAO.TAGS_POR_ATIVIDADE,
      ),
    );
    setTexto('');
  }

  function teclar(evento: KeyboardEvent<HTMLInputElement>): void {
    if (TECLAS_CONFIRMAR_TAG.has(evento.key) && texto.trim() !== '') {
      evento.preventDefault();
      adicionar();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {textosAtividades.rotuloTags}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          list={idLista}
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={teclar}
          onBlur={adicionar}
          maxLength={LIMITES_TEXTO.NOME_TAG}
          autoComplete="off"
          disabled={limiteAtingido}
          aria-invalid={descricao.possuiErro}
          aria-describedby={descricao.idsDescricao}
          className={classesControle(descricao.possuiErro, 'min-h-11 flex-1')}
        />
        <Botao
          variante="secundario"
          onClick={adicionar}
          disabled={texto.trim() === '' || limiteAtingido}
          className="w-auto shrink-0"
        >
          {textosAtividades.botaoAdicionarTag}
        </Botao>
      </div>
      <datalist id={idLista}>
        {sugestoesDisponiveis.map((sugestao) => (
          <option key={sugestao} value={sugestao} />
        ))}
      </datalist>
      <p id={descricao.idDica} className="text-xs text-texto-suave">
        {textosAtividades.dicaTags}
      </p>
      {descricao.possuiErro && (
        <p id={descricao.idErro} className="text-xs text-erro">
          {erros?.join(' ')}
        </p>
      )}
      {tags.length === 0 ? (
        <p className="text-xs text-texto-suave">
          {textosAtividades.semTagsSelecionadas}
        </p>
      ) : (
        <ul
          aria-label={textosAtividades.rotuloTags}
          className="flex flex-wrap gap-2"
        >
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-borda bg-fundo py-0.5 pr-1 pl-3 text-sm"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => setTags(tags.filter((atual) => atual !== tag))}
                aria-label={textosAtividades.removerTag(tag)}
                className="inline-flex size-8 items-center justify-center rounded-full text-texto-suave hover:bg-borda/60 focus-visible:outline-2 focus-visible:outline-primaria"
              >
                <span aria-hidden="true">×</span>
              </button>
              <input type="hidden" name={nome} value={tag} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
