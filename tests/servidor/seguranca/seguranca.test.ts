import {
  gerarHashSenha,
  precisaRecalcularHash,
  verificarSenha,
} from '@/servidor/seguranca/senha';
import {
  calcularHashToken,
  gerarCodigoLegivel,
  gerarTokenSeguro,
  normalizarCodigoLegivel,
} from '@/servidor/seguranca/tokens';

const SENHA_VALIDA = 'frase longa e exclusiva 2026';
const SENHA_COM_ACENTO_COMPOSTO = 'cora\u00e7\u00e3o valente 99';
const SENHA_COM_ACENTO_DECOMPOSTO = 'corac\u0327a\u0303o valente 99';
const FORMATO_HASH_ATUAL =
  /^scrypt\$N=65536,r=8,p=2\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/;
const HASH_COM_PARAMETROS_ANTIGOS = 'scrypt$N=16384,r=8,p=1$c2Fs$Y2hhdmU';
const TAMANHO_TOKEN_BASE64URL = 43;
const FORMATO_HASH_HEX = /^[0-9a-f]{64}$/;
const FORMATO_CODIGO = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

describe('senha', () => {
  let hashSenhaValida: string;

  beforeAll(async () => {
    hashSenhaValida = await gerarHashSenha(SENHA_VALIDA);
  });

  describe('gerarHashSenha', () => {
    it('deve gerar hash scrypt com os parâmetros atuais e sem a senha em texto', () => {
      expect(hashSenhaValida).toMatch(FORMATO_HASH_ATUAL);
      expect(hashSenhaValida).not.toContain(SENHA_VALIDA);
    });

    it('deve gerar hashes diferentes para a mesma senha por causa do sal', async () => {
      const outroHash = await gerarHashSenha(SENHA_VALIDA);

      expect(outroHash).not.toBe(hashSenhaValida);
    });
  });

  describe('verificarSenha', () => {
    it('deve aceitar a senha correta', async () => {
      const confere = await verificarSenha(SENHA_VALIDA, hashSenhaValida);

      expect(confere).toBe(true);
    });

    it('deve recusar a senha incorreta', async () => {
      const confere = await verificarSenha(`${SENHA_VALIDA}!`, hashSenhaValida);

      expect(confere).toBe(false);
    });

    it('deve aceitar a mesma senha digitada com acentos decompostos', async () => {
      const hash = await gerarHashSenha(SENHA_COM_ACENTO_COMPOSTO);

      const confere = await verificarSenha(SENHA_COM_ACENTO_DECOMPOSTO, hash);

      expect(confere).toBe(true);
    });

    it('deve recusar hash malformado sem lançar erro', async () => {
      const confere = await verificarSenha(SENHA_VALIDA, 'texto-qualquer');

      expect(confere).toBe(false);
    });
  });

  describe('precisaRecalcularHash', () => {
    it('não deve pedir recálculo para hash com os parâmetros atuais', () => {
      expect(precisaRecalcularHash(hashSenhaValida)).toBe(false);
    });

    it('deve pedir recálculo para hash com parâmetros antigos', () => {
      expect(precisaRecalcularHash(HASH_COM_PARAMETROS_ANTIGOS)).toBe(true);
    });
  });
});

describe('tokens', () => {
  describe('gerarTokenSeguro', () => {
    it('deve gerar tokens base64url de 256 bits e diferentes entre si', () => {
      const primeiro = gerarTokenSeguro();
      const segundo = gerarTokenSeguro();

      expect(primeiro).toHaveLength(TAMANHO_TOKEN_BASE64URL);
      expect(primeiro).not.toBe(segundo);
    });
  });

  describe('calcularHashToken', () => {
    it('deve gerar SHA-256 hexadecimal determinístico', () => {
      const token = gerarTokenSeguro();

      const hash = calcularHashToken(token);

      expect(hash).toMatch(FORMATO_HASH_HEX);
      expect(calcularHashToken(token)).toBe(hash);
      expect(hash).not.toContain(token);
    });
  });

  describe('gerarCodigoLegivel', () => {
    it('deve gerar código em quatro grupos sem letras ambíguas', () => {
      const codigo = gerarCodigoLegivel();

      expect(codigo).toMatch(FORMATO_CODIGO);
    });
  });

  describe('normalizarCodigoLegivel', () => {
    it('deve aceitar o código em minúsculas, com espaços e sem hífens', () => {
      const codigo = gerarCodigoLegivel();
      const digitado = ` ${codigo.replaceAll('-', ' ').toLowerCase()} `;

      expect(normalizarCodigoLegivel(digitado)).toBe(codigo);
    });
  });
});
