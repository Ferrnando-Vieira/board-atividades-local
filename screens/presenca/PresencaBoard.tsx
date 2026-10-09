'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import IconeAnimal from '@/components/animais/IconeAnimal';
import { obterClassesBotao } from '@/components/ui/Botao';
import Icone from '@/components/ui/Icone';
import MenuSuspenso from '@/components/ui/MenuSuspenso';
import { montarApelidoAnonimo } from '@/config/animais';
import { ROTAS } from '@/config/rotas';
import { textosPresenca as textos } from '@/screens/presenca/textosPresenca';
import type {
  PresencaExibida,
  ResultadoPresenca,
} from '@/servidor/presenca/presencaBoard';
import type { ContextoNavegacao } from '@/types/acesso';
import { combinarClasses } from '@/util/ClassesUtils';

const INTERVALO_SINAL_MS = 15_000;
const AVATARES_VISIVEIS = 4;
const CHAVE_VISITANTE = 'board-atividades:visitante';
const BYTES_IDENTIFICADOR = 18;
const ROTA_PRESENCA = '/presenca';
const TIPO_JSON = 'application/json';
// Sessão expirada (401) ou link revogado/expirado (404): o acesso acabou e
// insistir só repetiria a recusa.
const STATUS_SEM_ACESSO = new Set([401, 404]);

// crypto.randomUUID só existe em contexto seguro (HTTPS ou localhost); pela
// rede local o board é aberto por http://IP, então os bytes vêm de
// getRandomValues, que existe em qualquer contexto.
function gerarIdentificador(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES_IDENTIFICADOR));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

// O mesmo navegador é o mesmo visitante em todas as abas (e volta com o mesmo
// animal); sem localStorage, vale só para esta aba.
function obterIdentificadorVisitante(): string {
  try {
    const salvo = window.localStorage.getItem(CHAVE_VISITANTE);
    if (salvo) {
      return salvo;
    }
    const novo = gerarIdentificador();
    window.localStorage.setItem(CHAVE_VISITANTE, novo);
    return novo;
  } catch {
    return gerarIdentificador();
  }
}

// Link nomeado aparece pelo nome do link; o padrão, pelo animal anônimo.
function descreverPresenca(presenca: PresencaExibida): string {
  if (presenca.nome) {
    return presenca.nome;
  }
  return presenca.animal
    ? montarApelidoAnonimo(presenca.animal)
    : textos.proprietario;
}

function AvatarPresenca({
  presenca,
  className,
}: {
  presenca: PresencaExibida;
  className?: string;
}) {
  if (presenca.animal) {
    return (
      <IconeAnimal
        chave={presenca.animal}
        className={combinarClasses('ring-2 ring-superficie', className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={combinarClasses(
        'grid size-8 shrink-0 place-items-center rounded-full bg-primaria text-white ring-2 ring-superficie',
        className,
      )}
    >
      <Icone nome="usuario" />
    </span>
  );
}

// Fica fora do header (portal): o desfoque do header vira o bloco de
// contenção dos filhos `fixed`, e o aviso precisa se prender à tela.
function AvisoAcessoEncerrado({ porLink }: { porLink: boolean }) {
  return createPortal(
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg animate-surgir flex-wrap items-center gap-3 rounded-xl bg-texto p-4 text-sm text-texto-claro shadow-flutuante"
    >
      <Icone nome="relogio" />
      <p className="min-w-0 flex-1">
        {porLink ? textos.linkIndisponivel : textos.sessaoEncerrada}
      </p>
      {porLink ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={obterClassesBotao('secundario')}
        >
          {textos.recarregar}
        </button>
      ) : (
        <a href={ROTAS.ENTRAR} className={obterClassesBotao('secundario')}>
          {textos.entrarNovamente}
        </a>
      )}
    </div>,
    document.body,
  );
}

type PropriedadesPresencaBoard = {
  contexto: ContextoNavegacao;
};

// Mostra quem mais está com o board aberto, como no Google Docs: o
// proprietário aparece como tal; quem entra por link nomeado, com o nome do
// link; e pelo link padrão, como um animal anônimo sorteado pelo servidor.
export default function PresencaBoard({ contexto }: PropriedadesPresencaBoard) {
  const [resultado, setResultado] = useState<ResultadoPresenca | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const [acessoEncerrado, setAcessoEncerrado] = useState(false);
  const conhecidosRef = useRef<Set<string> | null>(null);
  const rota = `${contexto.prefixoRotas}${ROTA_PRESENCA}`;

  useEffect(() => {
    const visitanteId = obterIdentificadorVisitante();
    let ativa = true;

    async function enviarSinal(): Promise<void> {
      try {
        const resposta = await fetch(rota, {
          method: 'POST',
          headers: { 'Content-Type': TIPO_JSON },
          body: JSON.stringify({ visitanteId }),
          cache: 'no-store',
        });
        if (!ativa) {
          return;
        }
        if (STATUS_SEM_ACESSO.has(resposta.status)) {
          encerrar();
          setResultado(null);
          setAcessoEncerrado(true);
          return;
        }
        if (!resposta.ok) {
          return;
        }
        const dados = (await resposta.json()) as ResultadoPresenca;
        const novos = dados.presentes.filter(
          (presenca) =>
            presenca.id !== dados.voce.id &&
            conhecidosRef.current !== null &&
            !conhecidosRef.current.has(presenca.id),
        );
        conhecidosRef.current = new Set(
          dados.presentes.map((presenca) => presenca.id),
        );
        if (novos.length > 0) {
          setAnuncio(
            novos
              .map((presenca) => textos.entrou(descreverPresenca(presenca)))
              .join(' '),
          );
        }
        setResultado(dados);
      } catch {
        // Sem conexão: a lista atual fica até o próximo sinal.
      }
    }

    function aoVoltar(): void {
      if (document.visibilityState === 'visible') {
        void enviarSinal();
      }
    }

    // Ao fechar a aba, avisa a saída sem esperar a validade do sinal.
    function aoSair(): void {
      navigator.sendBeacon(
        rota,
        new Blob([JSON.stringify({ visitanteId, saindo: true })], {
          type: TIPO_JSON,
        }),
      );
    }

    function encerrar(): void {
      ativa = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('pagehide', aoSair);
    }

    void enviarSinal();
    const intervalo = window.setInterval(() => {
      void enviarSinal();
    }, INTERVALO_SINAL_MS);
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('pagehide', aoSair);
    return encerrar;
  }, [rota]);

  if (acessoEncerrado) {
    return (
      <AvisoAcessoEncerrado porLink={contexto.tokenCompartilhamento !== null} />
    );
  }
  if (!resultado) {
    return null;
  }
  const { voce } = resultado;
  // O proprietário em outra aba é a mesma pessoa: não conta como "outro".
  const outros = resultado.presentes.filter(
    (presenca) =>
      presenca.id !== voce.id &&
      !(voce.tipo === 'proprietario' && presenca.tipo === 'proprietario'),
  );
  if (outros.length === 0 && !voce.animal) {
    return null;
  }
  const visiveis = outros.slice(0, AVATARES_VISIVEIS);
  const excedentes = outros.length - visiveis.length;
  const rotulo =
    outros.length > 0
      ? textos.descreverBotao(outros.length)
      : textos.sozinhoComo(descreverPresenca(voce));
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      <MenuSuspenso
        rotulo={rotulo}
        classesBotao="px-1 hover:bg-texto/5"
        conteudoBotao={
          <span className="flex items-center -space-x-2" title={rotulo}>
            {(outros.length > 0 ? visiveis : [voce]).map((presenca) => (
              <AvatarPresenca key={presenca.id} presenca={presenca} />
            ))}
            {excedentes > 0 && (
              <span className="grid size-8 place-items-center rounded-full bg-fundo text-xs font-semibold text-texto-suave ring-2 ring-superficie">
                {textos.maisPessoas(excedentes)}
              </span>
            )}
          </span>
        }
      >
        <div className="flex flex-col gap-2 p-2">
          <h2 className="text-sm font-semibold">{textos.tituloPainel}</h2>
          <ul className="flex flex-col gap-1">
            {voce.animal && (
              <li className="flex items-center gap-3 rounded-lg bg-fundo/70 p-2 text-sm">
                <AvatarPresenca presenca={voce} />
                <span className="flex flex-col">
                  <span className="font-medium">{textos.voce}</span>
                  <span className="text-xs text-texto-suave">
                    {textos.vocePrefixo} {descreverPresenca(voce)}
                  </span>
                </span>
              </li>
            )}
            {outros.map((presenca) => (
              <li
                key={presenca.id}
                className="flex items-center gap-3 rounded-lg p-2 text-sm"
              >
                <AvatarPresenca presenca={presenca} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">
                    {descreverPresenca(presenca)}
                  </span>
                  {presenca.nome && (
                    <span className="text-xs text-texto-suave">
                      {textos.porLink}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-texto-suave">{textos.explicacao}</p>
        </div>
      </MenuSuspenso>
    </>
  );
}
