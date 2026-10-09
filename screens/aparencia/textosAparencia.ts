import type { ModoTomTexto } from '@/config/aparenciaBoard';
import { LIMITES_IMAGEM_FUNDO } from '@/config/fundosBoard';
import { formatarTamanhoArquivo } from '@/util/ArquivoUtils';
import type { NivelLeitura } from '@/util/CorUtils';
import type { NivelPrioridade } from '@/util/PrioridadeUtils';

export const textosAparencia = {
  titulo: 'Aparência',
  descricao:
    'Fundo, cores e transparência do board. Valem para você e para quem abre o link padrão; quem entra por um link nomeado também vê esta aparência até personalizar a própria.',
  descricaoLink:
    'Sua aparência: fundo, cores e transparência valem só para quem entra por este link e não mudam o board de mais ninguém.',
  descricaoLinkSeguindoBoard:
    'Por enquanto este link segue a aparência do board. A primeira alteração cria uma cópia só sua.',
  descricaoLinkPropria:
    'Este link tem aparência própria e não acompanha mais as mudanças feitas no board.',
  botaoRestaurar: 'Voltar à aparência do board',
  restaurando: 'Restaurando…',
  rotuloSecoes: 'Seções da aparência',
  secoes: {
    fundo: 'Fundos prontos',
    gradiente: 'Gradiente',
    imagem: 'Imagem',
    colunas: 'Colunas e títulos',
    prioridades: 'Prioridades',
  },
  tituloPredefinidos: 'Fundos prontos',
  legendaFundo: 'Fundo do board',
  dicaFundo:
    'Opções claras, que mantêm a leitura dos títulos, contagens e avisos com as cores padrão das colunas.',
  gruposPredefinidos: {
    tema: 'Tema',
    solido: 'Cores sólidas',
    linear: 'Gradientes lineares',
    radial: 'Gradientes radiais',
    malha: 'Combinações em malha',
  },
  botaoSalvar: 'Aplicar fundo',
  botaoSalvando: 'Salvando…',
  fundoAtual: 'atual',
  emUso: 'Em uso',
  alteracoesNaoAplicadas: 'Alterações não aplicadas',
  tituloGradiente: 'Gradiente personalizado',
  descricaoGradiente:
    'Escolha as cores e a direção. A prévia muda na hora; o board só muda ao aplicar.',
  legendaFormato: 'Tipo',
  formatos: { linear: 'Linear', radial: 'Radial' },
  rotulosAngulo: { linear: 'Ângulo', radial: 'Direção da luz' },
  descreverAngulo: (angulo: number) => `${angulo}°`,
  rotuloAnguloNumerico: 'Graus',
  rotuloAtalhosAngulo: 'Direções rápidas',
  dicasAngulo: {
    linear:
      'O gradiente vai na direção do ângulo: 0° para cima, 90° para a direita.',
    radial:
      'O centro do gradiente, na cor inicial, fica na borda indicada: 0° no topo, 90° à direita, 180° na base.',
  },
  descreverAtalhoAngulo: (angulo: number) => `Usar ${angulo} graus`,
  rotuloCorInicial: 'Cor inicial',
  rotuloCorIntermediaria: 'Cor intermediária',
  rotuloUsarCorIntermediaria: 'Usar uma terceira cor no meio',
  rotuloCorFinal: 'Cor final',
  rotuloPrevia: 'Prévia do board',
  previaColuna: 'A Fazer',
  previaCartaoUrgente: 'Fechar fatura do mês',
  previaCartaoComum: 'Revisar layout',
  previaTag: 'Faturas',
  previaRodape: '+ 1 atividade',
  botaoAplicarGradiente: 'Aplicar gradiente',
  tituloImagem: 'Imagem personalizada',
  descricaoImagem: `PNG, JPG ou WebP de até ${formatarTamanhoArquivo(LIMITES_IMAGEM_FUNDO.TAMANHO_MAXIMO_BYTES)}. A imagem cobre a tela sem distorcer, centralizada em qualquer tamanho de tela, e fica guardada só neste computador.`,
  rotuloArquivoImagem: 'Arquivo de imagem',
  rotuloPreviaImagem: 'Prévia da imagem escolhida',
  rotuloImagemAtual: 'Imagem em uso no fundo',
  botaoEnviarImagem: 'Usar esta imagem',
  enviandoImagem: 'Enviando…',
  botaoRemoverImagem: 'Remover imagem',
  removendoImagem: 'Removendo…',
  tituloRemocaoImagem: 'Remover a imagem de fundo?',
  confirmarRemocaoImagem:
    'A imagem é apagada deste computador e o board volta ao fundo padrão do tema.',
  avisoImagemSemCor:
    'Esta imagem foi enviada antes da escolha automática da cor do texto. Envie-a de novo para o board calcular o contraste com ela; até lá, o cálculo considera o pior caso.',
  cancelar: 'Cancelar',
  tituloSuperficies: 'Colunas e títulos',
  descricaoSuperficies:
    'Cor e transparência do fundo dos títulos e do corpo das colunas. A cor do texto se ajusta sozinha para continuar legível sobre o fundo do board.',
  rotuloCorTitulos: 'Cor do fundo dos títulos',
  rotuloCorColunas: 'Cor do fundo das colunas',
  rotuloOpacidadeTitulos: 'Opacidade dos títulos',
  rotuloOpacidadeColunas: 'Opacidade das colunas',
  descreverOpacidade: (opacidade: number) => `${opacidade}%`,
  dicaOpacidade: '0% é transparente; 100% é a cor sólida.',
  legendaTomTexto: 'Cor do texto',
  tonsTexto: {
    automatico: 'Automática (recomendado)',
    escuro: 'Sempre escura',
    claro: 'Sempre clara',
  } satisfies Record<ModoTomTexto, string>,
  dicaTomTexto:
    'Na automática, o board escolhe texto escuro ou claro conforme o contraste com o fundo.',
  rotuloLeituraTitulos: 'Leitura nos títulos',
  rotuloLeituraColunas: 'Leitura nas colunas',
  niveisLeitura: {
    boa: 'boa',
    atencao: 'atenção',
    dificil: 'difícil',
  } satisfies Record<NivelLeitura, string>,
  descreverContraste: (contraste: number) =>
    `contraste ${contraste.toFixed(1).replace('.', ',')}:1`,
  dicaColunaPorStatus:
    'Cada coluna pode ter cores próprias, definidas na tela Status.',
  botaoAplicarSuperficies: 'Aplicar cores das colunas',
  botaoRestaurarPadrao: 'Restaurar padrão',
  tituloPrioridades: 'Cores das prioridades',
  descricaoPrioridades:
    'Cor do selo e da faixa lateral dos cartões em cada nível. O texto do selo se ajusta à cor, e o número da prioridade continua visível.',
  niveisPrioridade: {
    critica: 'Crítica (0 a 1)',
    alta: 'Alta (2 a 3)',
    media: 'Média (4 a 6)',
    baixa: 'Baixa (7 a 9)',
  } satisfies Record<NivelPrioridade, string>,
  botaoAplicarPrioridades: 'Aplicar cores das prioridades',
} as const;
