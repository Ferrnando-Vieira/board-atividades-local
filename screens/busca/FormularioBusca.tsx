import { useId } from 'react';
import { CLASSES_CONTROLE } from '@/components/ui/EstruturaCampo';
import Icone from '@/components/ui/Icone';
import { LIMITES_TEXTO } from '@/config/constantes';
import { aplicarPrefixo, PARAMETRO_BUSCA, ROTAS } from '@/config/rotas';
import { textosBusca } from '@/screens/busca/textosBusca';
import { combinarClasses } from '@/util/ClassesUtils';

type PropriedadesFormularioBusca = {
  prefixoRotas: string;
  termo: string;
  // No quadro, o atalho "/" leva o foco a este campo.
  atalhoQuadro?: boolean;
};

// GET simples: o termo fica na URL, então recarregar repete a busca, e a
// página de resultados confere o acesso de novo no servidor.
export default function FormularioBusca({
  prefixoRotas,
  termo,
  atalhoQuadro = false,
}: PropriedadesFormularioBusca) {
  const id = useId();
  return (
    <form
      action={aplicarPrefixo(prefixoRotas, ROTAS.BUSCA)}
      method="get"
      role="search"
      className="relative flex min-w-0 flex-1 sm:flex-initial"
    >
      <label htmlFor={id} className="sr-only">
        {textosBusca.rotuloCampo}
      </label>
      <input
        id={id}
        type="search"
        name={PARAMETRO_BUSCA}
        defaultValue={termo}
        placeholder={textosBusca.placeholder}
        maxLength={LIMITES_TEXTO.TERMO_BUSCA}
        autoComplete="off"
        data-busca-quadro={atalhoQuadro ? '' : undefined}
        aria-keyshortcuts={atalhoQuadro ? '/' : undefined}
        className={combinarClasses(
          CLASSES_CONTROLE,
          'min-h-11 w-full min-w-0 border-borda pr-11 text-texto sm:w-72',
        )}
      />
      {atalhoQuadro && (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-11 hidden -translate-y-1/2 rounded border border-borda bg-fundo px-1.5 text-[0.6875rem] text-texto-suave sm:block"
        >
          /
        </kbd>
      )}
      <button
        type="submit"
        aria-label={textosBusca.botaoBuscar}
        title={textosBusca.botaoBuscar}
        className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-texto-suave hover:bg-texto/5 hover:text-texto focus-visible:outline-2 focus-visible:outline-primaria"
      >
        <Icone nome="busca" />
      </button>
    </form>
  );
}
