import type os from 'node:os';
import {
  detectarIpLan,
  ehEnderecoSomenteLocal,
  ehHostCuringa,
  listarIpsLan,
  type InterfacesRede,
} from '@/config/rede';
import configuracaoNext from '@/next.config';

function endereco(
  address: string,
  sobrescritas: Partial<os.NetworkInterfaceInfo> = {},
): os.NetworkInterfaceInfo {
  return {
    address,
    netmask: '255.255.255.0',
    family: 'IPv4',
    mac: '00:00:00:00:00:00',
    internal: false,
    cidr: `${address}/24`,
    ...sobrescritas,
  } as os.NetworkInterfaceInfo;
}

const INTERFACES_WINDOWS: InterfacesRede = {
  'Loopback Pseudo-Interface 1': [endereco('127.0.0.1', { internal: true })],
  'vEthernet (Default Switch)': [endereco('172.22.96.1')],
  'Ethernet 2': [endereco('10.0.0.5')],
  'Wi-Fi': [endereco('fe80::1', { family: 'IPv6' }), endereco('192.168.33.73')],
};

describe('rede', () => {
  it('deve preferir 192.168 e ignorar loopback, IPv6 e adaptadores virtuais', () => {
    expect(listarIpsLan(INTERFACES_WINDOWS)).toEqual([
      '192.168.33.73',
      '10.0.0.5',
    ]);
    expect(detectarIpLan(INTERFACES_WINDOWS)).toBe('192.168.33.73');
  });

  it.each([
    ['WSL', 'vEthernet (WSL)', '172.30.0.1'],
    ['Docker', 'docker0', '172.17.0.1'],
    ['VirtualBox', 'VirtualBox Host-Only Network', '192.168.56.1'],
    ['Tailscale', 'Tailscale', '100.64.0.3'],
  ])('deve ignorar o adaptador %s', (_nome, nome, ip) => {
    expect(listarIpsLan({ [nome]: [endereco(ip)] })).toEqual([]);
  });

  it('deve ignorar endereço link-local e IP público', () => {
    expect(
      listarIpsLan({
        Ethernet: [endereco('169.254.10.20'), endereco('200.10.10.10')],
      }),
    ).toEqual([]);
  });

  it('deve aceitar a família numérica do Node 18.0', () => {
    expect(
      listarIpsLan({
        Ethernet: [endereco('172.16.5.4', { family: 4 as unknown as 'IPv4' })],
      }),
    ).toEqual(['172.16.5.4']);
  });

  it('deve devolver nulo sem rede local', () => {
    expect(detectarIpLan({})).toBeNull();
  });

  it.each([
    ['0.0.0.0', true],
    ['::', true],
    ['127.0.0.1', false],
    ['192.168.0.10', false],
  ])('deve reconhecer host curinga em %s', (host, curinga) => {
    expect(ehHostCuringa(host)).toBe(curinga);
  });

  it.each([
    ['http://127.0.0.1:3000', true],
    ['http://localhost:3000', true],
    ['http://192.168.33.73:3000', false],
    ['https://board.lan', false],
    ['não é url', true],
  ])('deve saber se %s só abre nesta máquina', (url, somenteLocal) => {
    expect(ehEnderecoSomenteLocal(url)).toBe(somenteLocal);
  });
});

describe('origens do npm run dev', () => {
  it('deve liberar 127.0.0.1 e localhost mesmo com HOST=0.0.0.0', () => {
    expect(configuracaoNext.allowedDevOrigins).toEqual(
      expect.arrayContaining(['127.0.0.1', 'localhost']),
    );
  });
});
