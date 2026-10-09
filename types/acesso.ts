// Parte do acesso que vai para componentes cliente: só o necessário para
// montar links internos e reenviar a credencial do link às Server Actions.
export type ContextoNavegacao = {
  prefixoRotas: string;
  tokenCompartilhamento: string | null;
  somenteLeitura: boolean;
};
