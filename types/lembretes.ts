// Um lembrete pertence a uma atividade ou é avulso (sem cartão).
export type OrigemLembrete = 'atividade' | 'avulso';

// Formato que a sincronização devolve ao navegador: só o que a central de
// lembretes exibe, já com o horário formatado no fuso do board. Conforme a
// origem, vem preenchido o identificador da atividade ou o do lembrete
// avulso (o outro fica nulo).
export type NotificacaoLembreteExibida = {
  chave: string;
  origem: OrigemLembrete;
  atividadeId: number | null;
  lembreteAvulsoId: number | null;
  titulo: string;
  observacao: string | null;
  lembreteEm: string;
  horarioExibido: string;
  atrasado: boolean;
  rotaAtividade: string | null;
};

// Lembrete ainda por disparar, para a lista "Próximos".
export type LembreteProximoExibido = Omit<
  NotificacaoLembreteExibida,
  'atrasado'
>;

// `novas` são as que dispararam nesta chamada (a única que as recebe assim);
// `aDispensar` é a lista completa ainda não dispensada, que sobrevive à
// recarga da página; `proximos` são os pendentes das duas origens.
export type ResultadoSincronizacaoLembretes = {
  novas: NotificacaoLembreteExibida[];
  aDispensar: NotificacaoLembreteExibida[];
  proximos: LembreteProximoExibido[];
};
