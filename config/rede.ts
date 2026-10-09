import os from 'node:os';

export type InterfacesRede = NodeJS.Dict<os.NetworkInterfaceInfo[]>;

// Escutar em 0.0.0.0 (ou ::) atende todas as interfaces: 127.0.0.1 continua
// valendo nesta máquina, e o endereço que os outros computadores usam é o IP
// da rede local, detectado abaixo.
const HOSTS_CURINGA = new Set(['0.0.0.0', '::', '[::]']);

// Adaptadores que não são a rede local de verdade (máquinas virtuais, WSL,
// contêineres, VPNs): um link com esses IPs não abre nos outros computadores.
const ADAPTADORES_VIRTUAIS =
  /vethernet|wsl|virtualbox|vmware|vmnet|docker|hyper-v|tailscale|zerotier|bluetooth|loopback|vpn|tun|tap|utun|br-|virbr/i;

const PREFIXO_LINK_LOCAL = '169.254.';
const FAMILIA_IPV4 = 'IPv4';
// Node 18.0 chegou a devolver a família como número.
const FAMILIA_IPV4_NUMERICA = 4;
const SEGUNDO_OCTETO_172_MINIMO = 16;
const SEGUNDO_OCTETO_172_MAXIMO = 31;

// Ordem de preferência entre as faixas privadas: redes domésticas e de
// escritório costumam ser 192.168.x.x; 10.x e 172.16–31 vêm depois.
function prioridadeFaixaPrivada(ip: string): number | null {
  const [primeiro, segundo] = ip.split('.').map(Number);
  if (primeiro === 192 && segundo === 168) {
    return 0;
  }
  if (primeiro === 10) {
    return 1;
  }
  if (
    primeiro === 172 &&
    segundo !== undefined &&
    segundo >= SEGUNDO_OCTETO_172_MINIMO &&
    segundo <= SEGUNDO_OCTETO_172_MAXIMO
  ) {
    return 2;
  }
  return null;
}

function ehIpv4(endereco: os.NetworkInterfaceInfo): boolean {
  const familia: unknown = endereco.family;
  return familia === FAMILIA_IPV4 || familia === FAMILIA_IPV4_NUMERICA;
}

export function ehHostCuringa(host: string): boolean {
  return HOSTS_CURINGA.has(host);
}

// IPs privados desta máquina na rede local, do mais provável ao menos
// provável. Vazio sem rede (ou só com adaptadores virtuais).
export function listarIpsLan(
  interfaces: InterfacesRede = os.networkInterfaces(),
): string[] {
  const candidatos: { ip: string; prioridade: number }[] = [];
  for (const [nome, enderecos] of Object.entries(interfaces)) {
    if (ADAPTADORES_VIRTUAIS.test(nome)) {
      continue;
    }
    for (const endereco of enderecos ?? []) {
      if (
        endereco.internal ||
        !ehIpv4(endereco) ||
        endereco.address.startsWith(PREFIXO_LINK_LOCAL)
      ) {
        continue;
      }
      const prioridade = prioridadeFaixaPrivada(endereco.address);
      if (prioridade !== null) {
        candidatos.push({ ip: endereco.address, prioridade });
      }
    }
  }
  return candidatos
    .sort((primeiro, segundo) => primeiro.prioridade - segundo.prioridade)
    .map((candidato) => candidato.ip)
    .filter((ip, indice, lista) => lista.indexOf(ip) === indice);
}

export function detectarIpLan(
  interfaces: InterfacesRede = os.networkInterfaces(),
): string | null {
  return listarIpsLan(interfaces)[0] ?? null;
}

const HOSTS_SOMENTE_LOCAIS = new Set(['127.0.0.1', 'localhost', '[::1]']);

// Link com endereço desta máquina não abre em outro computador da rede.
export function ehEnderecoSomenteLocal(url: string): boolean {
  try {
    return HOSTS_SOMENTE_LOCAIS.has(new URL(url).hostname);
  } catch {
    return true;
  }
}
