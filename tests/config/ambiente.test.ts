import path from 'node:path';
import { lerAmbiente } from '@/config/ambiente';

const DIRETORIO_PROJETO = path.resolve('/projeto-teste');
const PORTA_LAN = 8080;

describe('ambiente', () => {
  describe('lerAmbiente', () => {
    it('deve aplicar padrões seguros quando nada é configurado', () => {
      const ambiente = lerAmbiente({}, DIRETORIO_PROJETO);

      expect(ambiente).toEqual({
        host: '127.0.0.1',
        porta: 3000,
        urlBaseLan: 'http://127.0.0.1:3000',
        urlBaseLanInformada: null,
        caminhoBancoSqlite: path.join(
          DIRETORIO_PROJETO,
          'dados',
          'board-atividades.sqlite',
        ),
        diretorioAnexos: path.join(DIRETORIO_PROJETO, 'dados', 'anexos'),
        cookieSeguro: false,
        notificacoesWindows: true,
      });
    });

    it('deve permitir desligar as notificações do Windows', () => {
      const ambiente = lerAmbiente(
        { NOTIFICACOES_WINDOWS: 'false' },
        DIRETORIO_PROJETO,
      );

      expect(ambiente.notificacoesWindows).toBe(false);
    });

    it('deve tratar valores vazios do .env como ausentes', () => {
      const ambiente = lerAmbiente(
        { HOST: '', PORTA: '', URL_BASE_LAN: '', COOKIE_SEGURO: '' },
        DIRETORIO_PROJETO,
      );

      expect(ambiente.porta).toBe(3000);
      expect(ambiente.urlBaseLan).toBe('http://127.0.0.1:3000');
    });

    it('deve aceitar configuração explícita para a rede local', () => {
      const ambiente = lerAmbiente(
        {
          HOST: '0.0.0.0',
          PORTA: String(PORTA_LAN),
          URL_BASE_LAN: 'http://192.168.0.10:8080',
          COOKIE_SEGURO: 'true',
        },
        DIRETORIO_PROJETO,
      );

      expect(ambiente).toEqual(
        expect.objectContaining({
          host: '0.0.0.0',
          porta: PORTA_LAN,
          urlBaseLan: 'http://192.168.0.10:8080',
          cookieSeguro: true,
        }),
      );
    });

    it('deve montar a URL base com o IP da rede local quando escuta em todas as interfaces', () => {
      const interfaces = {
        'Wi-Fi': [
          {
            address: '192.168.33.73',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: '192.168.33.73/24',
          } as const,
        ],
      };

      const ambiente = lerAmbiente(
        { HOST: '0.0.0.0' },
        DIRETORIO_PROJETO,
        interfaces,
      );
      const semRede = lerAmbiente({ HOST: '0.0.0.0' }, DIRETORIO_PROJETO, {});

      expect(ambiente.urlBaseLan).toBe('http://192.168.33.73:3000');
      expect(ambiente.urlBaseLanInformada).toBeNull();
      expect(semRede.urlBaseLan).toBe('http://127.0.0.1:3000');
    });

    it.each(['0', '70000', 'abc', '30.5'])(
      'deve recusar porta inválida (%s)',
      (porta) => {
        expect(() => lerAmbiente({ PORTA: porta }, DIRETORIO_PROJETO)).toThrow(
          'PORTA',
        );
      },
    );

    it('deve recusar URL base com protocolo diferente de http(s)', () => {
      expect(() =>
        lerAmbiente({ URL_BASE_LAN: 'ftp://192.168.0.10' }, DIRETORIO_PROJETO),
      ).toThrow('URL_BASE_LAN');
    });

    it('deve recusar diretório de anexos dentro de public/', () => {
      expect(() =>
        lerAmbiente({ DIRETORIO_ANEXOS: './public/anexos' }, DIRETORIO_PROJETO),
      ).toThrow('DIRETORIO_ANEXOS');
    });

    it('deve recusar banco SQLite dentro de public/', () => {
      expect(() =>
        lerAmbiente(
          { CAMINHO_BANCO_SQLITE: 'public/board.sqlite' },
          DIRETORIO_PROJETO,
        ),
      ).toThrow('CAMINHO_BANCO_SQLITE');
    });
  });
});
