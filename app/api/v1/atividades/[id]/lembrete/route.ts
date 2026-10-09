import { montarMetodosApi } from '@/servidor/api/manipuladorApi';
import {
  rotaDefinirLembreteAtividade,
  rotaExcluirLembreteAtividade,
} from '@/servidor/api/rotas/rotasLembretesAtividade';

export const { GET, POST, PUT, PATCH, DELETE } = montarMetodosApi({
  PUT: rotaDefinirLembreteAtividade,
  DELETE: rotaExcluirLembreteAtividade,
});
