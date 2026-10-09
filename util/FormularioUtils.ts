import type { ValoresFormulario } from '@/types/formulario';

// Arquivos enviados num campo de texto são descartados e o valor vazio cai na
// validação normal; o arquivo de um anexo é lido à parte, em acoesAnexos.
export function lerValoresFormulario(
  dados: FormData,
  campos: readonly string[],
  camposMultiplos: readonly string[] = [],
): ValoresFormulario {
  const valores: ValoresFormulario = {};
  for (const campo of campos) {
    const valor = dados.get(campo);
    valores[campo] = typeof valor === 'string' ? valor : '';
  }
  for (const campo of camposMultiplos) {
    valores[campo] = dados
      .getAll(campo)
      .filter((valor): valor is string => typeof valor === 'string');
  }
  return valores;
}

export function lerValorTexto(
  valores: ValoresFormulario | undefined,
  campo: string,
): string | undefined {
  const valor = valores?.[campo];
  return typeof valor === 'string' ? valor : undefined;
}

export function lerValorLista(
  valores: ValoresFormulario | undefined,
  campo: string,
): string[] | undefined {
  const valor = valores?.[campo];
  return Array.isArray(valor) ? valor : undefined;
}

// Fotografia dos campos de um formulário aberto na tela, para saber se há
// algo a perder ao fechar; de um arquivo escolhido vale só o nome.
export function serializarFormulario(formulario: HTMLFormElement): string {
  return JSON.stringify(
    Array.from(new FormData(formulario), ([campo, valor]) => [
      campo,
      typeof valor === 'string' ? valor : valor.name,
    ]),
  );
}
