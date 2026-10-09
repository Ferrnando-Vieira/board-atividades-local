import path from 'node:path';
import { z } from 'zod';
import {
  detectarIpLan,
  ehHostCuringa,
  type InterfacesRede,
} from '@/config/rede';

const HOST_PADRAO = '127.0.0.1';
const HOST_SEM_REDE = '127.0.0.1';
const PORTA_PADRAO = 3000;
const PORTA_MINIMA = 1;
const PORTA_MAXIMA = 65535;
const CAMINHO_BANCO_PADRAO = './dados/board-atividades.sqlite';
const DIRETORIO_ANEXOS_PADRAO = './dados/anexos';
const DIRETORIO_PUBLICO = 'public';
const PROTOCOLOS_URL_BASE = /^https?$/;

export type Ambiente = {
  host: string;
  porta: number;
  // Endereço que os outros dispositivos usam (links e API). Sem URL_BASE_LAN
  // e escutando em todas as interfaces, vem do IP detectado na rede local.
  urlBaseLan: string;
  urlBaseLanInformada: string | null;
  caminhoBancoSqlite: string;
  diretorioAnexos: string;
  cookieSeguro: boolean;
  // Toast nativo do Windows disparado pelo servidor, com o navegador fechado.
  notificacoesWindows: boolean;
};

// Linhas vazias no .env (ex.: "URL_BASE_LAN=") chegam como string vazia e
// devem cair no valor padrão em vez de falhar a validação.
function tratarVazioComoAusente<T extends z.ZodType>(esquema: T) {
  return z.preprocess((valor) => (valor === '' ? undefined : valor), esquema);
}

const esquemaAmbiente = z.object({
  HOST: tratarVazioComoAusente(z.string().trim().min(1).default(HOST_PADRAO)),
  PORTA: tratarVazioComoAusente(
    z.coerce
      .number()
      .int()
      .min(PORTA_MINIMA)
      .max(PORTA_MAXIMA)
      .default(PORTA_PADRAO),
  ),
  URL_BASE_LAN: tratarVazioComoAusente(
    z.url({ protocol: PROTOCOLOS_URL_BASE }).optional(),
  ),
  CAMINHO_BANCO_SQLITE: tratarVazioComoAusente(
    z.string().trim().min(1).default(CAMINHO_BANCO_PADRAO),
  ),
  DIRETORIO_ANEXOS: tratarVazioComoAusente(
    z.string().trim().min(1).default(DIRETORIO_ANEXOS_PADRAO),
  ),
  COOKIE_SEGURO: tratarVazioComoAusente(z.stringbool().default(false)),
  NOTIFICACOES_WINDOWS: tratarVazioComoAusente(z.stringbool().default(true)),
});

function estaDentroDe(diretorioBase: string, caminho: string): boolean {
  const relativo = path.relative(diretorioBase, caminho);
  return (
    relativo === '' ||
    (!relativo.startsWith('..') && !path.isAbsolute(relativo))
  );
}

function resolverCaminhoPrivado(
  nomeVariavel: string,
  valor: string,
  diretorioProjeto: string,
): string {
  const caminhoAbsoluto = path.resolve(diretorioProjeto, valor);
  const diretorioPublico = path.resolve(diretorioProjeto, DIRETORIO_PUBLICO);
  if (estaDentroDe(diretorioPublico, caminhoAbsoluto)) {
    throw new Error(
      `${nomeVariavel} não pode apontar para dentro de "${DIRETORIO_PUBLICO}/": o conteúdo seria servido sem autorização.`,
    );
  }
  return caminhoAbsoluto;
}

function formatarErrosAmbiente(erro: z.ZodError): string {
  return erro.issues
    .map((problema) => `${problema.path.join('.')}: ${problema.message}`)
    .join('; ');
}

type VariaveisAmbiente = Readonly<Record<string, string | undefined>>;

// Com HOST curinga (0.0.0.0), o endereço útil para a rede é o IP da LAN; sem
// rede detectada, sobra o endereço desta máquina.
export function montarUrlBase(
  host: string,
  porta: number,
  interfaces?: InterfacesRede,
): string {
  const endereco = ehHostCuringa(host)
    ? (detectarIpLan(interfaces) ?? HOST_SEM_REDE)
    : host;
  return `http://${endereco}:${porta}`;
}

export function lerAmbiente(
  variaveis: VariaveisAmbiente = process.env,
  diretorioProjeto: string = process.cwd(),
  interfaces?: InterfacesRede,
): Ambiente {
  const resultado = esquemaAmbiente.safeParse(variaveis);
  if (!resultado.success) {
    throw new Error(
      `Variáveis de ambiente inválidas: ${formatarErrosAmbiente(resultado.error)}`,
    );
  }
  const valores = resultado.data;
  return {
    host: valores.HOST,
    porta: valores.PORTA,
    urlBaseLan:
      valores.URL_BASE_LAN ??
      montarUrlBase(valores.HOST, valores.PORTA, interfaces),
    urlBaseLanInformada: valores.URL_BASE_LAN ?? null,
    caminhoBancoSqlite: resolverCaminhoPrivado(
      'CAMINHO_BANCO_SQLITE',
      valores.CAMINHO_BANCO_SQLITE,
      diretorioProjeto,
    ),
    diretorioAnexos: resolverCaminhoPrivado(
      'DIRETORIO_ANEXOS',
      valores.DIRETORIO_ANEXOS,
      diretorioProjeto,
    ),
    cookieSeguro: valores.COOKIE_SEGURO,
    notificacoesWindows: valores.NOTIFICACOES_WINDOWS,
  };
}

let ambienteEmCache: Ambiente | undefined;

export function obterAmbiente(): Ambiente {
  ambienteEmCache ??= lerAmbiente();
  return ambienteEmCache;
}

// O IP da rede pode mudar (DHCP) com o servidor no ar: sem URL_BASE_LAN, o
// endereço é detectado de novo a cada link gerado.
export function obterUrlBaseLan(): string {
  const ambiente = obterAmbiente();
  return (
    ambiente.urlBaseLanInformada ?? montarUrlBase(ambiente.host, ambiente.porta)
  );
}
