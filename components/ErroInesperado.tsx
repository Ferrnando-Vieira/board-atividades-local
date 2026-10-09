import Botao from '@/components/ui/Botao';
import Cartao from '@/components/ui/Cartao';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';

type PropriedadesErroInesperado = {
  aoTentarNovamente: () => void;
};

export default function ErroInesperado({
  aoTentarNovamente,
}: PropriedadesErroInesperado) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 sm:p-8">
      <Cartao className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">{textosAplicacao.erroTitulo}</h1>
        <p className="text-sm text-texto-suave">
          {textosAplicacao.erroDescricao}
        </p>
        <Botao onClick={aoTentarNovamente}>
          {textosAplicacao.erroTentarNovamente}
        </Botao>
      </Cartao>
    </main>
  );
}
