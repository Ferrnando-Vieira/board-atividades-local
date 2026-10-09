import { inicializarBanco } from './suporte/inicializacaoBanco';
import { carregarAmbiente, executarScript } from './suporte/suporteScripts';

executarScript(() => {
  inicializarBanco(carregarAmbiente());
});
