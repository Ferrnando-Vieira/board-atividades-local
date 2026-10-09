import { useId } from 'react';
import { ehImagemExibivel } from '@/config/anexos';
import { montarRotaAnexo, montarRotaImagemAnexo } from '@/config/rotas';
import FormularioEnvioAnexo from '@/screens/atividades/FormularioEnvioAnexo';
import FormularioRemocaoAnexo from '@/screens/atividades/FormularioRemocaoAnexo';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import type { AnexoResumo } from '@/servidor/anexos/consultasAnexos';
import type { AcessoPainel } from '@/servidor/web/acessoPainel';
import { formatarTamanhoArquivo } from '@/util/ArquivoUtils';
import { formatarInstanteParaExibicao } from '@/util/DataUtils';

type PropriedadesSecaoAnexos = {
  anexos: readonly AnexoResumo[];
  atividadeId: number;
  arquivada: boolean;
  fusoHorario: string;
  acesso: AcessoPainel;
  // Anexos usados como imagem na descrição: a remoção avisa que a imagem
  // deixa de aparecer lá.
  idsNaDescricao: readonly number[];
};

// O download passa por rota própria, que confere o acesso de novo: o link na
// tela não é a autorização. Enviar e remover seguem a capacidade de gestão
// do acesso (administrador ou link completo) e as Server Actions conferem
// tudo outra vez no servidor.
export default function SecaoAnexos({
  anexos,
  atividadeId,
  arquivada,
  fusoHorario,
  acesso,
  idsNaDescricao,
}: PropriedadesSecaoAnexos) {
  const idTitulo = useId();
  const podeAlterar = acesso.permiteGestao && !arquivada;
  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-3">
      <h2 id={idTitulo} className="text-sm font-semibold">
        {textosAtividades.rotuloAnexos}
      </h2>
      {anexos.length === 0 ? (
        <p className="text-sm text-texto-suave">{textosAtividades.semAnexos}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borda rounded-lg border border-borda">
          {anexos.map((anexo) => (
            <li
              key={anexo.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                {ehImagemExibivel(anexo.tipoConteudo) && (
                  <a
                    href={montarRotaImagemAnexo(anexo.id, acesso.prefixoRotas)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={textosAtividades.abrirImagemAnexo(
                      anexo.nomeOriginal,
                    )}
                    className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-primaria"
                  >
                    {/* Anexo privado servido pela rota autorizada. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={montarRotaImagemAnexo(anexo.id, acesso.prefixoRotas)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-12 rounded-md border border-borda bg-fundo object-cover"
                    />
                  </a>
                )}
                <div className="flex min-w-0 flex-col">
                  <a
                    href={montarRotaAnexo(anexo.id, acesso.prefixoRotas)}
                    className="inline-flex min-h-11 items-center text-sm break-all text-primaria underline focus-visible:outline-2 focus-visible:outline-primaria"
                  >
                    {textosAtividades.baixarAnexo(
                      anexo.nomeOriginal,
                      formatarTamanhoArquivo(anexo.tamanhoBytes),
                    )}
                  </a>
                  <span className="text-xs text-texto-suave">
                    {textosAtividades.descreverEnvioAnexo(
                      formatarInstanteParaExibicao(anexo.criadoEm, fusoHorario),
                    )}
                  </span>
                </div>
              </div>
              {podeAlterar && (
                <FormularioRemocaoAnexo
                  atividadeId={atividadeId}
                  anexoId={anexo.id}
                  nomeArquivo={anexo.nomeOriginal}
                  usadoNaDescricao={idsNaDescricao.includes(anexo.id)}
                  credencial={acesso.tokenCompartilhamento}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {podeAlterar && (
        <FormularioEnvioAnexo
          atividadeId={atividadeId}
          credencial={acesso.tokenCompartilhamento}
        />
      )}
      {acesso.permiteGestao && arquivada && (
        <p className="text-xs text-texto-suave">
          {textosAtividades.anexosSomenteLeitura}
        </p>
      )}
    </section>
  );
}
