-- Ajustada à mão a partir do drizzle-kit generate, pelo mesmo motivo da 0001
-- à 0003: o migrador roda numa transação com foreign_keys ativo, então
-- recriar `status_board` e `tags` (como o gerador propõe para incluir CHECKs)
-- esbarraria nas chaves estrangeiras das atividades. As colunas novas entram
-- com ADD COLUMN e CHECKs de coluna, validados contra as linhas existentes,
-- que recebem os padrões (cores nulas = cores do tema). `lembretes_avulsos`
-- é nova e não referencia atividades.
CREATE TABLE `lembretes_avulsos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` integer NOT NULL,
	`titulo` text NOT NULL,
	`observacao` text,
	`lembrete_em` text NOT NULL,
	`situacao` text DEFAULT 'pendente' NOT NULL,
	`disparado_em` text,
	`dispensado_em` text,
	`versao` integer DEFAULT 1 NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "lembretes_avulsos_titulo_valido" CHECK(length(trim("lembretes_avulsos"."titulo")) > 0 AND length("lembretes_avulsos"."titulo") <= 120),
	CONSTRAINT "lembretes_avulsos_observacao_tamanho" CHECK("lembretes_avulsos"."observacao" IS NULL OR length("lembretes_avulsos"."observacao") <= 500),
	CONSTRAINT "lembretes_avulsos_lembrete_em_formato" CHECK("lembretes_avulsos"."lembrete_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "lembretes_avulsos_situacao_valida" CHECK("lembretes_avulsos"."situacao" IN ('pendente', 'disparado', 'cancelado')),
	CONSTRAINT "lembretes_avulsos_disparo_coerente" CHECK("lembretes_avulsos"."disparado_em" IS NULL OR "lembretes_avulsos"."situacao" = 'disparado'),
	CONSTRAINT "lembretes_avulsos_disparado_em_formato" CHECK("lembretes_avulsos"."disparado_em" IS NULL OR "lembretes_avulsos"."disparado_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "lembretes_avulsos_dispensado_em_formato" CHECK("lembretes_avulsos"."dispensado_em" IS NULL OR "lembretes_avulsos"."dispensado_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "lembretes_avulsos_dispensa_coerente" CHECK("lembretes_avulsos"."dispensado_em" IS NULL OR ("lembretes_avulsos"."situacao" = 'disparado' AND "lembretes_avulsos"."disparado_em" IS NOT NULL)),
	CONSTRAINT "lembretes_avulsos_versao_positiva" CHECK("lembretes_avulsos"."versao" >= 1)
);
--> statement-breakpoint
CREATE INDEX `lembretes_avulsos_pendentes` ON `lembretes_avulsos` (`lembrete_em`) WHERE "lembretes_avulsos"."situacao" = 'pendente';--> statement-breakpoint
CREATE INDEX `lembretes_avulsos_a_dispensar` ON `lembretes_avulsos` (`disparado_em`) WHERE "lembretes_avulsos"."situacao" = 'disparado' AND "lembretes_avulsos"."dispensado_em" IS NULL;--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `imagem_cor_media` text CONSTRAINT "fundos_board_imagem_cor_media_formato" CHECK("imagem_cor_media" IS NULL OR "imagem_cor_media" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `cor_titulos` text DEFAULT '#ffffff' NOT NULL CONSTRAINT "fundos_board_cor_titulos_formato" CHECK("cor_titulos" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `cor_colunas` text DEFAULT '#f4f6f3' NOT NULL CONSTRAINT "fundos_board_cor_colunas_formato" CHECK("cor_colunas" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `opacidade_titulos` integer DEFAULT 90 NOT NULL CONSTRAINT "fundos_board_opacidade_titulos_intervalo" CHECK("opacidade_titulos" BETWEEN 0 AND 100);--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `opacidade_colunas` integer DEFAULT 90 NOT NULL CONSTRAINT "fundos_board_opacidade_colunas_intervalo" CHECK("opacidade_colunas" BETWEEN 0 AND 100);--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `tom_texto` text DEFAULT 'automatico' NOT NULL CONSTRAINT "fundos_board_tom_texto_valido" CHECK("tom_texto" IN ('automatico', 'escuro', 'claro'));--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `cor_prioridade_critica` text CONSTRAINT "fundos_board_cor_prioridade_critica_formato" CHECK("cor_prioridade_critica" IS NULL OR "cor_prioridade_critica" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `cor_prioridade_alta` text CONSTRAINT "fundos_board_cor_prioridade_alta_formato" CHECK("cor_prioridade_alta" IS NULL OR "cor_prioridade_alta" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `cor_prioridade_media` text CONSTRAINT "fundos_board_cor_prioridade_media_formato" CHECK("cor_prioridade_media" IS NULL OR "cor_prioridade_media" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');--> statement-breakpoint
ALTER TABLE `fundos_board` ADD `cor_prioridade_baixa` text CONSTRAINT "fundos_board_cor_prioridade_baixa_formato" CHECK("cor_prioridade_baixa" IS NULL OR "cor_prioridade_baixa" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');--> statement-breakpoint
ALTER TABLE `status_board` ADD `cor_titulo` text CONSTRAINT "status_board_cor_titulo_formato" CHECK("cor_titulo" IS NULL OR "cor_titulo" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');--> statement-breakpoint
ALTER TABLE `status_board` ADD `cor_coluna` text CONSTRAINT "status_board_cor_coluna_formato" CHECK("cor_coluna" IS NULL OR "cor_coluna" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');--> statement-breakpoint
ALTER TABLE `tags` ADD `cor` text CONSTRAINT "tags_cor_formato" CHECK("cor" IS NULL OR "cor" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');
