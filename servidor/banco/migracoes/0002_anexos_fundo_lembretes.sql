-- Ajustada à mão a partir do drizzle-kit generate, pelo mesmo motivo da 0001:
-- o migrador roda numa transação com foreign_keys ativo, então recriar
-- `atividades` faria o DROP apagar em cascata as tags das atividades e
-- esbarrar no RESTRICT de `anexos`; recriar `boards` esbarraria no RESTRICT de
-- status, atividades e links. As duas colunas entram com ADD COLUMN e CHECK de
-- coluna (validado contra as linhas existentes), sem reescrever dados.
-- Anexos não precisaram de mudança: a tabela da 0000 já tinha metadados,
-- identificador interno, hash e remoção lógica.
ALTER TABLE `boards` ADD `fundo` text DEFAULT 'padrao' NOT NULL CONSTRAINT "boards_fundo_valido" CHECK("fundo" IN ('padrao', 'cor-areia', 'cor-ceu', 'cor-lavanda', 'cor-menta', 'cor-nevoa', 'gradiente-amanhecer', 'gradiente-oceano', 'gradiente-campo', 'gradiente-aurora'));--> statement-breakpoint
ALTER TABLE `atividades` ADD `lembrete_dispensado_em` text CONSTRAINT "atividades_lembrete_dispensado_em_formato" CHECK("lembrete_dispensado_em" IS NULL OR "lembrete_dispensado_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z') CONSTRAINT "atividades_lembrete_dispensa_coerente" CHECK("lembrete_dispensado_em" IS NULL OR ("lembrete_situacao" = 'disparado' AND "lembrete_disparado_em" IS NOT NULL));--> statement-breakpoint
CREATE INDEX `atividades_lembretes_a_dispensar` ON `atividades` (`lembrete_disparado_em`) WHERE "atividades"."lembrete_situacao" = 'disparado' AND "atividades"."lembrete_dispensado_em" IS NULL;
