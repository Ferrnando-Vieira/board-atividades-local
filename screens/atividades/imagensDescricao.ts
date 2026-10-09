import { ehImagemExibivel } from '@/config/anexos';
import { montarRotaImagemAnexo } from '@/config/rotas';
import { montarReferenciaAnexo } from '@/util/DescricaoUtils';

// Para onde aponta cada referência de imagem da descrição ("anexo:ID" ou
// "anexo-novo:CHAVE"); referência fora do mapa aparece como indisponível.
// `href` abre a imagem inteira numa aba nova.
export type ImagemDescricao = {
  src: string;
  href: string | null;
};

export type ImagensDescricao = Readonly<Record<string, ImagemDescricao>>;

type AnexoComImagem = {
  id: number;
  tipoConteudo: string;
};

// Só os anexos da própria atividade entram: uma referência digitada para o
// anexo de outra atividade não vira imagem, mesmo que o acesso o alcance.
export function montarImagensDescricao(
  anexos: readonly AnexoComImagem[],
  prefixoRotas: string,
): ImagensDescricao {
  return Object.fromEntries(
    anexos
      .filter((anexo) => ehImagemExibivel(anexo.tipoConteudo))
      .map((anexo) => {
        const rota = montarRotaImagemAnexo(anexo.id, prefixoRotas);
        return [montarReferenciaAnexo(anexo.id), { src: rota, href: rota }];
      }),
  );
}
