import { z } from 'zod';
import { FORMATO_COR_HEXADECIMAL } from '@/util/CorUtils';

// Campos não preenchidos chegam do FormData como string vazia; campos que não
// existem no formulário chegam como null.
function ehVazio(valor: unknown): boolean {
  return (
    valor === null ||
    valor === undefined ||
    (typeof valor === 'string' && valor.trim() === '')
  );
}

function vazioComoNulo(valor: unknown): unknown {
  return ehVazio(valor) ? null : valor;
}

export function campoTextoOpcional(
  tamanhoMaximo: number,
  mensagemTamanho: string,
) {
  return z.preprocess(
    vazioComoNulo,
    z.string().trim().max(tamanhoMaximo, { error: mensagemTamanho }).nullable(),
  );
}

export function campoDataOpcional(mensagem: string) {
  return z.preprocess(
    vazioComoNulo,
    z.iso.date({ error: mensagem }).nullable(),
  );
}

export function campoHoraOpcional(mensagem: string) {
  return z.preprocess(
    vazioComoNulo,
    z.iso.time({ precision: -1, error: mensagem }).nullable(),
  );
}

export function campoIdentificador(mensagem: string) {
  return z.coerce
    .number({ error: mensagem })
    .int({ error: mensagem })
    .positive({ error: mensagem });
}

export function campoIdentificadorOpcional(mensagem: string) {
  return z.preprocess(vazioComoNulo, campoIdentificador(mensagem).nullable());
}

export function campoInteiroComPadrao(
  minimo: number,
  maximo: number,
  padrao: number,
  mensagem: string,
) {
  return z.preprocess(
    (valor) => (ehVazio(valor) ? undefined : valor),
    z.coerce
      .number({ error: mensagem })
      .int({ error: mensagem })
      .min(minimo, { error: mensagem })
      .max(maximo, { error: mensagem })
      .default(padrao),
  );
}

// Cor "#rrggbb" (normalizada para minúsculas) ou nula quando o campo vem
// vazio ou desabilitado ("usar a cor padrão").
export function campoCorOpcional(mensagem: string) {
  return z.preprocess(
    (valor) =>
      typeof valor === 'string' && !ehVazio(valor)
        ? valor.trim().toLowerCase()
        : vazioComoNulo(valor),
    z
      .string({ error: mensagem })
      .regex(FORMATO_COR_HEXADECIMAL, { error: mensagem })
      .nullable(),
  );
}

export function campoMarcado(valorMarcado: string) {
  return z.preprocess((valor) => valor === valorMarcado, z.boolean());
}

// Só aceita um dos valores oferecidos na tela; em branco significa "nenhum".
export function campoOpcaoInteiraOpcional(
  opcoes: readonly number[],
  mensagem: string,
) {
  return z.preprocess(
    vazioComoNulo,
    z.coerce
      .number({ error: mensagem })
      .int({ error: mensagem })
      .refine((valor) => opcoes.includes(valor), { error: mensagem })
      .nullable(),
  );
}

// Caixas de seleção repetem o mesmo nome; ausente vira lista vazia e os
// identificadores repetidos são descartados.
export function campoListaIdentificadores(
  maximo: number,
  mensagemInvalido: string,
  mensagemLimite: string,
) {
  return z.preprocess(
    (valor) => (valor === null || valor === undefined ? [] : valor),
    z
      .array(campoIdentificador(mensagemInvalido), {
        error: mensagemInvalido,
      })
      .max(maximo, { error: mensagemLimite })
      .transform((identificadores) => [...new Set(identificadores)]),
  );
}

export const identificadorJson = z.int().positive();
