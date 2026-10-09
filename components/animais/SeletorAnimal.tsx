import { useId } from 'react';
import IconeAnimal from '@/components/animais/IconeAnimal';
import { ANIMAIS, type ChaveAnimal } from '@/config/animais';

const VALOR_SORTEADO = '';

const CLASSES_OPCAO =
  'flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-borda p-2 text-center text-xs leading-tight transition-colors hover:bg-fundo has-checked:border-primaria has-checked:bg-primaria-suave has-checked:font-semibold has-checked:text-primaria-escura has-focus-visible:outline-2 has-focus-visible:outline-primaria';

type PropriedadesSeletorAnimal = {
  nome: string;
  legenda: string;
  rotuloSorteado: string;
  valorInicial: ChaveAnimal | null;
  dica?: string;
  erros?: string[];
};

// Grade de rádios com o desenho de cada animal; em branco ("sortear") é o
// comportamento de sempre, um animal diferente a cada visitante.
export default function SeletorAnimal({
  nome,
  legenda,
  rotuloSorteado,
  valorInicial,
  dica,
  erros,
}: PropriedadesSeletorAnimal) {
  const prefixo = useId();
  const idDica = `${prefixo}-dica`;
  const idErros = `${prefixo}-erros`;
  const possuiErro = erros !== undefined && erros.length > 0;
  const descritores = [dica ? idDica : null, possuiErro ? idErros : null]
    .filter((id) => id !== null)
    .join(' ');
  const opcoes = [
    { valor: VALOR_SORTEADO, rotulo: rotuloSorteado, chave: null },
    ...ANIMAIS.map((animal) => ({
      valor: animal.chave,
      rotulo: animal.nome,
      chave: animal.chave,
    })),
  ];
  return (
    <fieldset
      aria-describedby={descritores || undefined}
      className="flex flex-col gap-2"
    >
      <legend className="text-sm font-semibold">{legenda}</legend>
      {dica && (
        <p id={idDica} className="text-xs text-texto-suave">
          {dica}
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
        {opcoes.map((opcao) => (
          <label key={opcao.valor || 'sorteado'} className={CLASSES_OPCAO}>
            <input
              type="radio"
              name={nome}
              value={opcao.valor}
              defaultChecked={(valorInicial ?? VALOR_SORTEADO) === opcao.valor}
              className="sr-only"
            />
            {opcao.chave ? (
              <IconeAnimal chave={opcao.chave} className="size-10" />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-full border-2 border-dashed border-borda text-lg font-semibold text-texto-suave"
              >
                ?
              </span>
            )}
            <span className="break-words">{opcao.rotulo}</span>
          </label>
        ))}
      </div>
      {possuiErro && (
        <p id={idErros} className="text-xs text-erro">
          {erros.join(' ')}
        </p>
      )}
    </fieldset>
  );
}
