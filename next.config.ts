import type { NextConfig } from 'next';
import { LIMITES_ANEXO } from './config/anexos';
import { listarIpsLan } from './config/rede';

// Referrer-Policy no-referrer: links de compartilhamento futuros carregam o
// token na URL e ele não pode vazar para sites externos.
const CABECALHOS_SEGURANCA = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

// Só os envios com arquivos (anexos e imagens coladas na descrição) têm corpo
// grande; o próprio serviço recusa o que passar dos limites por arquivo e por
// envio, e a margem cobre o multipart e os campos de texto.
const LIMITE_CORPO_SERVER_ACTION_BYTES =
  LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES +
  LIMITES_ANEXO.MARGEM_CORPO_ENVIO_BYTES;

// No `npm run dev`, o Next só entrega os recursos de desenvolvimento (HMR,
// chunks) para origens conhecidas. Com HOST=0.0.0.0, nem 127.0.0.1 entra
// sozinho na lista (só "localhost" e o próprio --hostname): sem ele, a página
// aberta nesta máquina não hidrata. Os IPs da rede local entram para o board
// funcionar quando aberto de outro computador.
const ORIGENS_DESTA_MAQUINA = ['127.0.0.1', 'localhost'];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: [...ORIGENS_DESTA_MAQUINA, ...listarIpsLan()],
  experimental: {
    serverActions: {
      bodySizeLimit: LIMITE_CORPO_SERVER_ACTION_BYTES,
    },
  },
  async headers() {
    return [{ source: '/:path*', headers: CABECALHOS_SEGURANCA }];
  },
};

export default nextConfig;
