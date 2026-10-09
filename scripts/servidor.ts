import { spawn } from 'node:child_process';
import path from 'node:path';
import { obterUrlBaseLan, type Ambiente } from '@/config/ambiente';
import { ehEnderecoSomenteLocal } from '@/config/rede';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  garantirLinkPadrao,
  obterOuCriarChaveLinkPadrao,
  resolverCaminhoChaveLinkPadrao,
} from '@/servidor/compartilhamento/linkPadrao';
import { exibirToastWindows } from '@/servidor/lembretes/toastWindows';
import { iniciarVigiaLembretes } from '@/servidor/lembretes/vigiaLembretes';
import {
  abrirBancoInicializado,
  carregarAmbiente,
  executarScript,
} from './suporte/suporteScripts';

const COMANDOS_NEXT = {
  desenvolvimento: 'dev',
  producao: 'start',
} as const;

const MENSAGEM_LINK_PADRAO_CRIADO =
  'Link padrão de visualização (somente leitura) criado. Copie o endereço em "Compartilhar board".';
const MENSAGEM_LINK_PADRAO_REAPROVEITADO =
  'Link padrão de visualização (somente leitura) ativo. Copie o endereço em "Compartilhar board".';
const MENSAGEM_LINK_PADRAO_FALHOU =
  'Link padrão de visualização não preparado:';

type Modo = keyof typeof COMANDOS_NEXT;

const HOSTS_SOMENTE_LOCAIS = new Set(['127.0.0.1', 'localhost', '::1']);
const CAMINHO_BINARIO_NEXT = path.join(
  process.cwd(),
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

function lerModo(argumento: string | undefined): Modo {
  if (argumento === 'desenvolvimento' || argumento === 'producao') {
    return argumento;
  }
  throw new Error('Uso: tsx scripts/servidor.ts <desenvolvimento|producao>');
}

const ENDERECO_LOCAL = 'http://127.0.0.1';

function avisarSobreExposicao(ambiente: Ambiente): void {
  const urlBaseLan = obterUrlBaseLan();
  if (HOSTS_SOMENTE_LOCAIS.has(ambiente.host)) {
    console.log(`Servidor acessível apenas nesta máquina: ${urlBaseLan}`);
    return;
  }
  console.log(`Nesta máquina: ${ENDERECO_LOCAL}:${ambiente.porta}`);
  if (ehEnderecoSomenteLocal(urlBaseLan)) {
    console.warn(
      'Nenhum IP de rede local detectado: os links de compartilhamento só abrem nesta máquina.',
    );
    return;
  }
  console.log(`Na rede local: ${urlBaseLan}`);
  console.warn(
    `Atenção: escutando em ${ambiente.host}; outros dispositivos da rede local poderão acessar o board. Libere a porta ${ambiente.porta} só no perfil Privado do Firewall do Windows (README, seção "Acesso pela rede local") e nunca a exponha à internet.`,
  );
}

function descreverFalha(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

// Na inicialização, o link padrão (somente leitura) é reaproveitado ou criado.
// O endereço não vai para o terminal: o proprietário o copia no painel. Banco
// ausente ou com migrações pendentes não impede a subida do servidor.
function prepararLinkPadrao(ambiente: Ambiente): void {
  let banco: BancoDados | null = null;
  try {
    banco = abrirBancoInicializado(ambiente);
    const link = garantirLinkPadrao(
      banco,
      obterOuCriarChaveLinkPadrao(
        resolverCaminhoChaveLinkPadrao(ambiente.caminhoBancoSqlite),
      ),
    );
    console.log(
      link.criado
        ? MENSAGEM_LINK_PADRAO_CRIADO
        : MENSAGEM_LINK_PADRAO_REAPROVEITADO,
    );
  } catch (erro) {
    console.warn(`${MENSAGEM_LINK_PADRAO_FALHOU} ${descreverFalha(erro)}`);
  } finally {
    if (banco) {
      fecharBanco(banco);
    }
  }
}

// Os toasts do Windows saem do servidor, não do navegador: aparecem no
// horário mesmo com o board fechado. A URL de clique usa 127.0.0.1, porque o
// toast abre no navegador desta máquina.
function iniciarNotificacoesWindows(ambiente: Ambiente): () => void {
  if (process.platform !== 'win32' || !ambiente.notificacoesWindows) {
    return () => undefined;
  }
  console.log(
    'Notificações do Windows ativas: lembretes aparecem como toast mesmo com o board fechado.',
  );
  return iniciarVigiaLembretes({
    abrirBanco: () => abrirBancoInicializado(ambiente),
    exibirAviso: exibirToastWindows,
    urlBase: `${ENDERECO_LOCAL}:${ambiente.porta}`,
    aoFalhar: (erro) =>
      console.warn(`Notificações do Windows: ${descreverFalha(erro)}`),
  });
}

// O PORT/hostname precisa chegar ao Next pela linha de comando: o servidor HTTP
// sobe antes de o Next ler os arquivos .env.
executarScript(
  () =>
    new Promise<void>((concluir) => {
      const modo = lerModo(process.argv[2]);
      const ambiente = carregarAmbiente({
        desenvolvimento: modo === 'desenvolvimento',
      });
      avisarSobreExposicao(ambiente);
      prepararLinkPadrao(ambiente);
      const encerrarNotificacoes = iniciarNotificacoesWindows(ambiente);
      const processoNext = spawn(
        process.execPath,
        [
          CAMINHO_BINARIO_NEXT,
          COMANDOS_NEXT[modo],
          '--hostname',
          ambiente.host,
          '--port',
          String(ambiente.porta),
        ],
        { stdio: 'inherit' },
      );
      processoNext.on('exit', (codigo) => {
        encerrarNotificacoes();
        process.exitCode = codigo ?? 0;
        concluir();
      });
    }),
);
