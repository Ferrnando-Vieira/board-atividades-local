-- Ajustada à mão a partir do drizzle-kit generate, pelo mesmo motivo da 0001
-- e da 0002: o migrador roda numa transação com foreign_keys ativo, então
-- recriar `links_compartilhamento` faria o DROP apagar em cascata o escopo dos
-- links. A coluna `padrao` entra com ADD COLUMN e CHECKs de coluna (validados
-- contra as linhas existentes, que recebem 0), sem reescrever dados.
-- `fundos_board` é nova e recebe a escolha atual de cada board (a lista da
-- 0002 cabe inteira no catálogo novo); `boards.fundo` fica como legado.
CREATE TABLE `fundos_board` (
	`board_id` integer PRIMARY KEY NOT NULL,
	`tipo` text DEFAULT 'predefinido' NOT NULL,
	`chave_predefinida` text DEFAULT 'padrao' NOT NULL,
	`gradiente_formato` text DEFAULT 'linear' NOT NULL,
	`gradiente_angulo` integer DEFAULT 135 NOT NULL,
	`gradiente_cor_inicial` text DEFAULT '#dbeafe' NOT NULL,
	`gradiente_cor_intermediaria` text,
	`gradiente_cor_final` text DEFAULT '#ede9fe' NOT NULL,
	`imagem_identificador` text,
	`imagem_formato` text,
	`imagem_hash` text,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "fundos_board_tipo_valido" CHECK("fundos_board"."tipo" IN ('predefinido', 'gradiente', 'imagem')),
	CONSTRAINT "fundos_board_chave_valida" CHECK("fundos_board"."chave_predefinida" IN ('padrao', 'cor-areia', 'cor-ceu', 'cor-lavanda', 'cor-menta', 'cor-nevoa', 'gradiente-amanhecer', 'gradiente-oceano', 'gradiente-campo', 'gradiente-aurora', 'cor-gelo', 'cor-pessego', 'gradiente-pastel', 'gradiente-brisa', 'radial-luar', 'radial-pessego', 'radial-lagoa', 'malha-primavera', 'malha-entardecer')),
	CONSTRAINT "fundos_board_formato_valido" CHECK("fundos_board"."gradiente_formato" IN ('linear', 'radial')),
	CONSTRAINT "fundos_board_angulo_intervalo" CHECK("fundos_board"."gradiente_angulo" BETWEEN 0 AND 360),
	CONSTRAINT "fundos_board_cor_inicial_formato" CHECK("fundos_board"."gradiente_cor_inicial" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "fundos_board_cor_intermediaria_formato" CHECK("fundos_board"."gradiente_cor_intermediaria" IS NULL OR "fundos_board"."gradiente_cor_intermediaria" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "fundos_board_cor_final_formato" CHECK("fundos_board"."gradiente_cor_final" GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "fundos_board_imagem_completa" CHECK(("fundos_board"."imagem_identificador" IS NULL) = ("fundos_board"."imagem_formato" IS NULL) AND ("fundos_board"."imagem_identificador" IS NULL) = ("fundos_board"."imagem_hash" IS NULL)),
	CONSTRAINT "fundos_board_imagem_identificador_formato" CHECK("fundos_board"."imagem_identificador" IS NULL OR (length("fundos_board"."imagem_identificador") BETWEEN 16 AND 64 AND "fundos_board"."imagem_identificador" NOT GLOB '*[^0-9a-zA-Z_-]*')),
	CONSTRAINT "fundos_board_imagem_formato_valido" CHECK("fundos_board"."imagem_formato" IS NULL OR "fundos_board"."imagem_formato" IN ('png', 'jpeg', 'webp')),
	CONSTRAINT "fundos_board_imagem_hash_formato" CHECK("fundos_board"."imagem_hash" IS NULL OR length("fundos_board"."imagem_hash") = 64 AND "fundos_board"."imagem_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "fundos_board_imagem_exige_arquivo" CHECK("fundos_board"."tipo" <> 'imagem' OR "fundos_board"."imagem_identificador" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `fundos_board` (`board_id`, `chave_predefinida`) SELECT `id`, `fundo` FROM `boards`;--> statement-breakpoint
ALTER TABLE `links_compartilhamento` ADD `padrao` integer DEFAULT false NOT NULL CONSTRAINT "links_compartilhamento_padrao_booleano" CHECK("padrao" IN (0, 1)) CONSTRAINT "links_compartilhamento_padrao_somente_leitura" CHECK("padrao" = 0 OR ("modalidade" = 'restrito' AND "incluir_arquivadas" = 0 AND "expira_em" IS NULL));--> statement-breakpoint
CREATE UNIQUE INDEX `links_compartilhamento_padrao_ativo_unico` ON `links_compartilhamento` (`board_id`) WHERE "links_compartilhamento"."padrao" = 1 AND "links_compartilhamento"."revogado_em" IS NULL;
