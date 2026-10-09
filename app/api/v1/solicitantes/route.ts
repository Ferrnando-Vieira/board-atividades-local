import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaListarSolicitantes,
  rotaRegistrarSolicitante,
} from '@/servidor/api/rotas/rotasClassificacao';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaListarSolicitantes,
  POST: rotaRegistrarSolicitante,
});
