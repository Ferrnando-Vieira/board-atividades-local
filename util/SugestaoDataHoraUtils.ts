import {
  obterMomentoLocal,
  somarHoras,
  type MomentoLocal,
} from '@/util/DataUtils';

// Prazo e lembretes sugerem um horário algumas horas à frente; a conclusão
// sugere o momento atual.
export const HORAS_SUGESTAO_FUTURA = 4;

export type CampoDataHora = 'data' | 'hora';

// Campo em sugestão mostra o valor sugerido (em cinza) e envia vazio: a
// sugestão só facilita o preenchimento e nunca é gravada sozinha. Em uso, o
// valor é da pessoa e vai no envio.
export type EstadoCampoDataHora = {
  valor: string;
  emUso: boolean;
};

export type EstadoCamposDataHora = Record<CampoDataHora, EstadoCampoDataHora>;

// `vinculados`: data e hora obrigatórias (lembretes), usadas e soltas juntas.
// Sem vínculo (prazo, conclusão), a hora depende da data: usar a hora usa a
// data, e soltar a data solta a hora.
export type OpcoesCamposDataHora = {
  vinculados: boolean;
};

const EM_SUGESTAO: EstadoCampoDataHora = { valor: '', emUso: false };

// A data acompanha o horário sugerido: perto da meia-noite, "agora + 4 h"
// já é o dia seguinte, e data e hora continuam formando um instante futuro.
export function sugerirMomentoLocal(
  agora: Date,
  horasAFrente: number,
  fusoHorario: string,
): MomentoLocal {
  return obterMomentoLocal(somarHoras(agora, horasAFrente), fusoHorario);
}

export function iniciarCamposDataHora(
  data: string,
  hora: string,
): EstadoCamposDataHora {
  return {
    data: data === '' ? EM_SUGESTAO : { valor: data, emUso: true },
    hora: hora === '' ? EM_SUGESTAO : { valor: hora, emUso: true },
  };
}

function usarCampo(
  campo: EstadoCampoDataHora,
  sugestao: string,
): EstadoCampoDataHora {
  return campo.emUso ? campo : { valor: sugestao, emUso: true };
}

function camposUsadosJuntos(
  campo: CampoDataHora,
  opcoes: OpcoesCamposDataHora,
): CampoDataHora[] {
  if (opcoes.vinculados || campo === 'hora') {
    return ['data', 'hora'];
  }
  return ['data'];
}

// Clique ou tecla no campo: a sugestão vira o valor de partida (o seletor
// do navegador já abre nela).
export function usarSugestao(
  estado: EstadoCamposDataHora,
  campo: CampoDataHora,
  sugestao: MomentoLocal,
  opcoes: OpcoesCamposDataHora,
): EstadoCamposDataHora {
  const proximo = { ...estado };
  for (const alvo of camposUsadosJuntos(campo, opcoes)) {
    proximo[alvo] = usarCampo(estado[alvo], sugestao[alvo]);
  }
  return proximo;
}

export function alterarCampo(
  estado: EstadoCamposDataHora,
  campo: CampoDataHora,
  valor: string,
  sugestao: MomentoLocal,
  opcoes: OpcoesCamposDataHora,
): EstadoCamposDataHora {
  return {
    ...usarSugestao(estado, campo, sugestao, opcoes),
    [campo]: { valor, emUso: true },
  };
}

// Ao sair de um campo esvaziado, ele volta a mostrar a sugestão (sem ser
// enviado). Durante a digitação o vazio é mantido, para não atrapalhar.
export function soltarCampoVazio(
  estado: EstadoCamposDataHora,
  campo: CampoDataHora,
  opcoes: OpcoesCamposDataHora,
): EstadoCamposDataHora {
  if (!estado[campo].emUso || estado[campo].valor !== '') {
    return estado;
  }
  if (opcoes.vinculados || campo === 'data') {
    return limparCampos();
  }
  return { ...estado, hora: EM_SUGESTAO };
}

export function limparCampos(): EstadoCamposDataHora {
  return { data: EM_SUGESTAO, hora: EM_SUGESTAO };
}

export function lerValorEnviado(campo: EstadoCampoDataHora): string {
  return campo.emUso ? campo.valor : '';
}

export function lerValorExibido(
  campo: EstadoCampoDataHora,
  sugestao: string | null,
): string {
  return campo.emUso ? campo.valor : (sugestao ?? '');
}
