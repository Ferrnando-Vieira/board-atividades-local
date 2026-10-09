import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import { rotaDefinirSolicitantePadrao } from '@/servidor/api/rotas/rotasClassificacao';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  PUT: rotaDefinirSolicitantePadrao,
});
