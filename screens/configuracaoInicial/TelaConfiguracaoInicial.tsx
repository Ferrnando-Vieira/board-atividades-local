import Cartao from '@/components/ui/Cartao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import FormularioConfiguracaoInicial from '@/screens/configuracaoInicial/FormularioConfiguracaoInicial';
import { textosConfiguracaoInicial as textos } from '@/screens/configuracaoInicial/textosConfiguracaoInicial';
import type { EstadoInstalacao } from '@/servidor/administracao/estadoInstalacao';

type PropriedadesTela = {
  estado: Exclude<EstadoInstalacao, 'pronta'>;
};

export default function TelaConfiguracaoInicial({ estado }: PropriedadesTela) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 sm:p-8">
      <Cartao className="flex flex-col gap-4">
        {estado === 'configuracao-pendente' ? (
          <>
            <header className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold">{textos.titulo}</h1>
              <p className="text-sm text-texto-suave">{textos.descricao}</p>
            </header>
            <FormularioConfiguracaoInicial />
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">{textos.avisoTitulo}</h1>
            <MensagemAlerta tipo="aviso">
              {textos.avisos[estado]}
            </MensagemAlerta>
          </>
        )}
      </Cartao>
    </main>
  );
}
