const MILISSEGUNDOS_POR_SEGUNDO = 1000;
const MILISSEGUNDOS_POR_MINUTO = 60 * MILISSEGUNDOS_POR_SEGUNDO;
const MINUTOS_POR_HORA = 60;
const HORAS_POR_DIA = 24;
const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DIGITOS_ANO = 4;
const DIGITOS_CAMPO = 2;
const TAMANHO_DATA_ISO = 10;

export function agoraIso(): string {
  return new Date().toISOString();
}

export function somarMinutos(data: Date, minutos: number): Date {
  return new Date(data.getTime() + minutos * MILISSEGUNDOS_POR_MINUTO);
}

export function somarHoras(data: Date, horas: number): Date {
  return somarMinutos(data, horas * MINUTOS_POR_HORA);
}

export function somarDias(data: Date, dias: number): Date {
  return somarHoras(data, dias * HORAS_POR_DIA);
}

export function calcularExpiracaoEmDias(
  agora: Date,
  dias: number | null,
): string | null {
  return dias === null ? null : somarDias(agora, dias).toISOString();
}

function extrairNumeros(texto: string, formato: RegExp, descricao: string) {
  const correspondencia = formato.exec(texto);
  if (!correspondencia) {
    throw new Error(`${descricao} inválida: "${texto}"`);
  }
  return correspondencia.slice(1).map(Number);
}

// Aritmética de calendário sobre AAAA-MM-DD feita em UTC, onde não há
// horário de verão para pular ou repetir um dia.
export function somarDiasNaData(data: string, dias: number): string {
  const [ano = 0, mes = 0, dia = 0] = extrairNumeros(
    data,
    FORMATO_DATA,
    'Data',
  );
  return new Date(Date.UTC(ano, mes - 1, dia + dias))
    .toISOString()
    .slice(0, TAMANHO_DATA_ISO);
}

export function formatarDataParaExibicao(data: string): string {
  const correspondencia = FORMATO_DATA.exec(data);
  if (!correspondencia) {
    throw new Error(`Data inválida: "${data}"`);
  }
  const [, ano, mes, dia] = correspondencia;
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataComHoraOpcional(
  data: string,
  hora: string | null,
): string {
  const dataFormatada = formatarDataParaExibicao(data);
  return hora ? `${dataFormatada} ${hora}` : dataFormatada;
}

export type MomentoLocal = {
  data: string;
  hora: string;
};

type PartesLocais = {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
};

function obterPartesLocais(instante: Date, fusoHorario: string): PartesLocais {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fusoHorario,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instante);
  const valorDe = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value);
  return {
    ano: valorDe('year'),
    mes: valorDe('month'),
    dia: valorDe('day'),
    hora: valorDe('hour'),
    minuto: valorDe('minute'),
    segundo: valorDe('second'),
  };
}

function completarComZeros(valor: number, digitos: number): string {
  return String(valor).padStart(digitos, '0');
}

export function obterMomentoLocal(
  instante: Date,
  fusoHorario: string,
): MomentoLocal {
  const partes = obterPartesLocais(instante, fusoHorario);
  return {
    data: `${completarComZeros(partes.ano, DIGITOS_ANO)}-${completarComZeros(partes.mes, DIGITOS_CAMPO)}-${completarComZeros(partes.dia, DIGITOS_CAMPO)}`,
    hora: `${completarComZeros(partes.hora, DIGITOS_CAMPO)}:${completarComZeros(partes.minuto, DIGITOS_CAMPO)}`,
  };
}

function calcularDeslocamentoMs(instante: Date, fusoHorario: string): number {
  const partes = obterPartesLocais(instante, fusoHorario);
  const comoSeFosseUtc = Date.UTC(
    partes.ano,
    partes.mes - 1,
    partes.dia,
    partes.hora,
    partes.minuto,
    partes.segundo,
  );
  const instanteSemMilissegundos =
    Math.floor(instante.getTime() / MILISSEGUNDOS_POR_SEGUNDO) *
    MILISSEGUNDOS_POR_SEGUNDO;
  return comoSeFosseUtc - instanteSemMilissegundos;
}

// O deslocamento é recalculado no instante obtido porque, perto de uma troca
// de horário de verão, o deslocamento do palpite inicial pode ser o errado.
export function converterHorarioLocalParaUtc(
  data: string,
  hora: string,
  fusoHorario: string,
): Date {
  const [ano = 0, mes = 0, dia = 0] = extrairNumeros(
    data,
    FORMATO_DATA,
    'Data',
  );
  const [horas = 0, minutos = 0] = extrairNumeros(hora, FORMATO_HORA, 'Hora');
  const palpiteUtc = Date.UTC(ano, mes - 1, dia, horas, minutos);
  const primeiroDeslocamento = calcularDeslocamentoMs(
    new Date(palpiteUtc),
    fusoHorario,
  );
  const segundoDeslocamento = calcularDeslocamentoMs(
    new Date(palpiteUtc - primeiroDeslocamento),
    fusoHorario,
  );
  return new Date(palpiteUtc - segundoDeslocamento);
}

export function formatarInstanteParaExibicao(
  instanteIso: string,
  fusoHorario: string,
): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: fusoHorario,
  }).format(new Date(instanteIso));
}

export function formatarInstanteOpcional(
  instanteIso: string | null,
  fusoHorario: string,
): string | null {
  return instanteIso === null
    ? null
    : formatarInstanteParaExibicao(instanteIso, fusoHorario);
}
