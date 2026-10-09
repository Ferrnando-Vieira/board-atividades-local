'use client';

import { useId, useState } from 'react';
import CampoFormulario from '@/components/ui/CampoFormulario';
import { LIMITES_TEXTO } from '@/config/constantes';
import CampoTags from '@/screens/atividades/CampoTags';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { sugerirSolicitante } from '@/screens/atividades/valoresFormularioAtividade';

type PropriedadesCamposSolicitanteTags = {
  idSolicitante: string;
  nomeSolicitante: string;
  valorSolicitante: string;
  errosSolicitante?: string[];
  sugestoesSolicitantes: readonly string[];
  idTags: string;
  nomeTags: string;
  tagsIniciais: readonly string[];
  sugestoesTags: readonly string[];
  errosTags?: string[];
  // Na criação, o solicitante segue as tags escolhidas até ser digitado.
  automatico: boolean;
  solicitantesPadraoTags: Readonly<Record<string, string>>;
  solicitantePadrao: string | null;
};

// Solicitante e tags ficam juntos porque, numa atividade nova, o campo de
// solicitante mostra o padrão da primeira tag escolhida que tiver um (ou o do
// board) enquanto a pessoa não digitar outro nome.
export default function CamposSolicitanteTags({
  idSolicitante,
  nomeSolicitante,
  valorSolicitante,
  errosSolicitante,
  sugestoesSolicitantes,
  idTags,
  nomeTags,
  tagsIniciais,
  sugestoesTags,
  errosTags,
  automatico,
  solicitantesPadraoTags,
  solicitantePadrao,
}: PropriedadesCamposSolicitanteTags) {
  const idLista = useId();
  const [tags, setTags] = useState(tagsIniciais);
  const [digitado, setDigitado] = useState<string | null>(
    automatico ? null : valorSolicitante,
  );
  const sugerido = sugerirSolicitante(
    tags,
    solicitantesPadraoTags,
    solicitantePadrao,
  );
  const seguindoTags = digitado === null;
  return (
    <>
      <CampoFormulario
        id={idSolicitante}
        name={nomeSolicitante}
        rotulo={textosAtividades.rotuloSolicitante}
        dica={
          seguindoTags && sugerido.tag !== null
            ? textosAtividades.dicaSolicitanteDaTag(sugerido.tag)
            : textosAtividades.dicaSolicitante
        }
        value={digitado ?? sugerido.nome}
        onChange={(evento) => setDigitado(evento.target.value)}
        erros={errosSolicitante}
        list={idLista}
        maxLength={LIMITES_TEXTO.NOME_SOLICITANTE}
        autoComplete="off"
      />
      <datalist id={idLista}>
        {sugestoesSolicitantes.map((solicitante) => (
          <option key={solicitante} value={solicitante} />
        ))}
      </datalist>
      <CampoTags
        id={idTags}
        nome={nomeTags}
        valoresIniciais={tagsIniciais}
        sugestoes={sugestoesTags}
        erros={errosTags}
        aoAlterar={setTags}
      />
    </>
  );
}
