export type EstadoFormulario = {
  mensagemErro?: string;
  errosCampos?: Partial<Record<string, string[]>>;
};

export const ESTADO_FORMULARIO_INICIAL: EstadoFormulario = {};

export type ValoresFormulario = Partial<Record<string, string | string[]>>;

// `tentativa` muda a cada resposta para remontar os campos com os valores
// devolvidos: o React 19 reinicia formulários não controlados depois da ação.
export type EstadoFormularioGestao = EstadoFormulario & {
  mensagemSucesso?: string;
  valores?: ValoresFormulario;
  tentativa: number;
};

export const ESTADO_FORMULARIO_GESTAO_INICIAL: EstadoFormularioGestao = {
  tentativa: 0,
};

// Link ou token recém-gerado: existe só nesta resposta, porque o banco guarda
// apenas o hash.
export type EstadoCriacaoCredencial = EstadoFormularioGestao & {
  credencialGerada?: string;
};

export const ESTADO_CRIACAO_CREDENCIAL_INICIAL: EstadoCriacaoCredencial = {
  tentativa: 0,
};
