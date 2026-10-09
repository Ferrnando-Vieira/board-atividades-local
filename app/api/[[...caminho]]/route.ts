import {
  montarMetodosApi,
  rotaInexistente,
} from '@/servidor/api/manipuladorApi';

// Qualquer caminho de /api sem rota própria: JSON 404 (ou 401 sem token),
// em vez da página HTML de "não encontrada".
export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  GET: rotaInexistente,
  POST: rotaInexistente,
  PUT: rotaInexistente,
  PATCH: rotaInexistente,
  DELETE: rotaInexistente,
});
