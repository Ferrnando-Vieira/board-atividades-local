import Cartao from '@/components/ui/Cartao';
import LinkBotao from '@/components/ui/LinkBotao';
import { ROTAS } from '@/config/rotas';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';

export default function PaginaNaoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 sm:p-8">
      <Cartao className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">
          {textosAplicacao.naoEncontradaTitulo}
        </h1>
        <p className="text-sm text-texto-suave">
          {textosAplicacao.naoEncontradaDescricao}
        </p>
        <LinkBotao href={ROTAS.INICIO} variante="primario">
          {textosAplicacao.voltarAoQuadro}
        </LinkBotao>
      </Cartao>
    </main>
  );
}
