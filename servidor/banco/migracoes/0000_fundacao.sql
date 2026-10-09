CREATE TABLE `administrador` (
	`id` integer PRIMARY KEY NOT NULL,
	`usuario` text NOT NULL,
	`hash_senha` text NOT NULL,
	`tentativas_falhas` integer DEFAULT 0 NOT NULL,
	`bloqueado_ate` text,
	`senha_alterada_em` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "administrador_registro_unico" CHECK("administrador"."id" = 1),
	CONSTRAINT "administrador_usuario_valido" CHECK(length("administrador"."usuario") BETWEEN 3 AND 60 AND "administrador"."usuario" NOT GLOB '*[^a-z0-9._-]*'),
	CONSTRAINT "administrador_hash_senha_formato" CHECK("administrador"."hash_senha" GLOB 'scrypt$*'),
	CONSTRAINT "administrador_tentativas_nao_negativas" CHECK("administrador"."tentativas_falhas" >= 0),
	CONSTRAINT "administrador_bloqueado_ate_formato" CHECK("administrador"."bloqueado_ate" IS NULL OR "administrador"."bloqueado_ate" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z')
);
--> statement-breakpoint
CREATE TABLE `codigo_configuracao_inicial` (
	`id` integer PRIMARY KEY NOT NULL,
	`hash_codigo` text NOT NULL,
	`expira_em` text NOT NULL,
	`tentativas_falhas` integer DEFAULT 0 NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "codigo_configuracao_registro_unico" CHECK("codigo_configuracao_inicial"."id" = 1),
	CONSTRAINT "codigo_configuracao_hash_formato" CHECK(length("codigo_configuracao_inicial"."hash_codigo") = 64 AND "codigo_configuracao_inicial"."hash_codigo" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "codigo_configuracao_expira_em_formato" CHECK("codigo_configuracao_inicial"."expira_em" IS NULL OR "codigo_configuracao_inicial"."expira_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "codigo_configuracao_tentativas_nao_negativas" CHECK("codigo_configuracao_inicial"."tentativas_falhas" >= 0)
);
--> statement-breakpoint
CREATE TABLE `sessoes_administrativas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`administrador_id` integer NOT NULL,
	`hash_token` text NOT NULL,
	`expira_em` text NOT NULL,
	`ultimo_uso_em` text NOT NULL,
	`revogada_em` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`administrador_id`) REFERENCES `administrador`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sessoes_administrativas_hash_formato" CHECK(length("sessoes_administrativas"."hash_token") = 64 AND "sessoes_administrativas"."hash_token" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "sessoes_administrativas_expira_em_formato" CHECK("sessoes_administrativas"."expira_em" IS NULL OR "sessoes_administrativas"."expira_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "sessoes_administrativas_ultimo_uso_em_formato" CHECK("sessoes_administrativas"."ultimo_uso_em" IS NULL OR "sessoes_administrativas"."ultimo_uso_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "sessoes_administrativas_revogada_em_formato" CHECK("sessoes_administrativas"."revogada_em" IS NULL OR "sessoes_administrativas"."revogada_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessoes_administrativas_hash_token_unico` ON `sessoes_administrativas` (`hash_token`);--> statement-breakpoint
CREATE INDEX `sessoes_administrativas_expira_em` ON `sessoes_administrativas` (`expira_em`);--> statement-breakpoint
CREATE TABLE `anexos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`atividade_id` integer NOT NULL,
	`identificador_arquivo` text NOT NULL,
	`nome_original` text NOT NULL,
	`tipo_conteudo` text NOT NULL,
	`tamanho_bytes` integer NOT NULL,
	`hash_sha256` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`removido_em` text,
	FOREIGN KEY (`atividade_id`) REFERENCES `atividades`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "anexos_identificador_formato" CHECK(length("anexos"."identificador_arquivo") BETWEEN 16 AND 64 AND "anexos"."identificador_arquivo" NOT GLOB '*[^0-9a-zA-Z_-]*'),
	CONSTRAINT "anexos_nome_original_valido" CHECK(length(trim("anexos"."nome_original")) > 0 AND length("anexos"."nome_original") <= 255),
	CONSTRAINT "anexos_tipo_conteudo_preenchido" CHECK(length(trim("anexos"."tipo_conteudo")) > 0),
	CONSTRAINT "anexos_tamanho_positivo" CHECK("anexos"."tamanho_bytes" > 0),
	CONSTRAINT "anexos_hash_formato" CHECK(length("anexos"."hash_sha256") = 64 AND "anexos"."hash_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "anexos_removido_em_formato" CHECK("anexos"."removido_em" IS NULL OR "anexos"."removido_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anexos_identificador_arquivo_unico` ON `anexos` (`identificador_arquivo`);--> statement-breakpoint
CREATE INDEX `anexos_atividade` ON `anexos` (`atividade_id`);--> statement-breakpoint
CREATE TABLE `atividades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` integer NOT NULL,
	`status_id` integer NOT NULL,
	`solicitante_id` integer NOT NULL,
	`titulo` text NOT NULL,
	`descricao` text,
	`prioridade` integer DEFAULT 5 NOT NULL,
	`ordem` integer NOT NULL,
	`arquivada_em` text,
	`prazo_data` text,
	`prazo_hora` text,
	`concluida_em_data` text,
	`concluida_em_hora` text,
	`lembrete_em` text,
	`lembrete_situacao` text,
	`lembrete_disparado_em` text,
	`versao` integer DEFAULT 1 NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`status_id`) REFERENCES `status_board`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`solicitante_id`) REFERENCES `solicitantes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "atividades_titulo_valido" CHECK(length(trim("atividades"."titulo")) > 0 AND length("atividades"."titulo") <= 300),
	CONSTRAINT "atividades_descricao_tamanho" CHECK("atividades"."descricao" IS NULL OR length("atividades"."descricao") <= 20000),
	CONSTRAINT "atividades_prioridade_intervalo" CHECK("atividades"."prioridade" BETWEEN 0 AND 9),
	CONSTRAINT "atividades_ordem_nao_negativa" CHECK("atividades"."ordem" >= 0),
	CONSTRAINT "atividades_arquivada_em_formato" CHECK("atividades"."arquivada_em" IS NULL OR "atividades"."arquivada_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "atividades_prazo_data_formato" CHECK("atividades"."prazo_data" IS NULL OR ("atividades"."prazo_data" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND date("atividades"."prazo_data") = "atividades"."prazo_data")),
	CONSTRAINT "atividades_prazo_hora_formato" CHECK("atividades"."prazo_hora" IS NULL OR ("atividades"."prazo_hora" GLOB '[0-2][0-9]:[0-5][0-9]' AND "atividades"."prazo_hora" <= '23:59')),
	CONSTRAINT "atividades_prazo_hora_exige_data" CHECK("atividades"."prazo_hora" IS NULL OR "atividades"."prazo_data" IS NOT NULL),
	CONSTRAINT "atividades_conclusao_data_formato" CHECK("atividades"."concluida_em_data" IS NULL OR ("atividades"."concluida_em_data" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND date("atividades"."concluida_em_data") = "atividades"."concluida_em_data")),
	CONSTRAINT "atividades_conclusao_hora_formato" CHECK("atividades"."concluida_em_hora" IS NULL OR ("atividades"."concluida_em_hora" GLOB '[0-2][0-9]:[0-5][0-9]' AND "atividades"."concluida_em_hora" <= '23:59')),
	CONSTRAINT "atividades_conclusao_hora_exige_data" CHECK("atividades"."concluida_em_hora" IS NULL OR "atividades"."concluida_em_data" IS NOT NULL),
	CONSTRAINT "atividades_lembrete_em_formato" CHECK("atividades"."lembrete_em" IS NULL OR "atividades"."lembrete_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "atividades_lembrete_situacao_valida" CHECK("atividades"."lembrete_situacao" IS NULL OR "atividades"."lembrete_situacao" IN ('pendente', 'disparado', 'cancelado')),
	CONSTRAINT "atividades_lembrete_completo" CHECK(("atividades"."lembrete_em" IS NULL) = ("atividades"."lembrete_situacao" IS NULL)),
	CONSTRAINT "atividades_lembrete_disparo_coerente" CHECK("atividades"."lembrete_disparado_em" IS NULL OR "atividades"."lembrete_situacao" = 'disparado'),
	CONSTRAINT "atividades_lembrete_disparado_em_formato" CHECK("atividades"."lembrete_disparado_em" IS NULL OR "atividades"."lembrete_disparado_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "atividades_versao_positiva" CHECK("atividades"."versao" >= 1)
);
--> statement-breakpoint
CREATE INDEX `atividades_board_status` ON `atividades` (`board_id`,`status_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `atividades_ordem_ativa_unica` ON `atividades` (`status_id`,`ordem`) WHERE "atividades"."arquivada_em" IS NULL;--> statement-breakpoint
CREATE INDEX `atividades_lembretes_pendentes` ON `atividades` (`lembrete_em`) WHERE "atividades"."lembrete_situacao" = 'pendente';--> statement-breakpoint
CREATE TABLE `atividades_tags` (
	`atividade_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`atividade_id`, `tag_id`),
	FOREIGN KEY (`atividade_id`) REFERENCES `atividades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `atividades_tags_tag` ON `atividades_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `boards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chave` text NOT NULL,
	`nome` text NOT NULL,
	`fuso_horario` text NOT NULL,
	`versao` integer DEFAULT 1 NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "boards_chave_preenchida" CHECK(length(trim("boards"."chave")) > 0),
	CONSTRAINT "boards_nome_valido" CHECK(length(trim("boards"."nome")) > 0 AND length("boards"."nome") <= 120),
	CONSTRAINT "boards_fuso_preenchido" CHECK(length(trim("boards"."fuso_horario")) > 0),
	CONSTRAINT "boards_versao_positiva" CHECK("boards"."versao" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boards_chave_unica` ON `boards` (`chave`);--> statement-breakpoint
CREATE TABLE `status_board` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` integer NOT NULL,
	`chave` text NOT NULL,
	`nome` text NOT NULL,
	`posicao` integer NOT NULL,
	`finaliza_atividade` integer DEFAULT false NOT NULL,
	`versao` integer DEFAULT 1 NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "status_board_chave_preenchida" CHECK(length(trim("status_board"."chave")) > 0),
	CONSTRAINT "status_board_nome_valido" CHECK(length(trim("status_board"."nome")) > 0 AND length("status_board"."nome") <= 60),
	CONSTRAINT "status_board_posicao_nao_negativa" CHECK("status_board"."posicao" >= 0),
	CONSTRAINT "status_board_finaliza_booleano" CHECK("status_board"."finaliza_atividade" IN (0, 1)),
	CONSTRAINT "status_board_versao_positiva" CHECK("status_board"."versao" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `status_board_chave_unica` ON `status_board` (`board_id`,`chave`);--> statement-breakpoint
CREATE UNIQUE INDEX `status_board_nome_unico` ON `status_board` (`board_id`,`nome`);--> statement-breakpoint
CREATE UNIQUE INDEX `status_board_posicao_unica` ON `status_board` (`board_id`,`posicao`);--> statement-breakpoint
CREATE TABLE `solicitantes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` integer NOT NULL,
	`nome` text NOT NULL,
	`nome_normalizado` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "solicitantes_nome_valido" CHECK(length(trim("solicitantes"."nome")) > 0 AND length("solicitantes"."nome") <= 120),
	CONSTRAINT "solicitantes_nome_normalizado_preenchido" CHECK(length(trim("solicitantes"."nome_normalizado")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `solicitantes_nome_normalizado_unico` ON `solicitantes` (`board_id`,`nome_normalizado`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` integer NOT NULL,
	`nome` text NOT NULL,
	`nome_normalizado` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tags_nome_valido" CHECK(length(trim("tags"."nome")) > 0 AND length("tags"."nome") <= 60),
	CONSTRAINT "tags_nome_normalizado_preenchido" CHECK(length(trim("tags"."nome_normalizado")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_nome_normalizado_unico` ON `tags` (`board_id`,`nome_normalizado`);--> statement-breakpoint
CREATE TABLE `escopo_link_solicitantes` (
	`link_id` integer NOT NULL,
	`solicitante_id` integer NOT NULL,
	PRIMARY KEY(`link_id`, `solicitante_id`),
	FOREIGN KEY (`link_id`) REFERENCES `links_compartilhamento`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`solicitante_id`) REFERENCES `solicitantes`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `escopo_link_status` (
	`link_id` integer NOT NULL,
	`status_id` integer NOT NULL,
	PRIMARY KEY(`link_id`, `status_id`),
	FOREIGN KEY (`link_id`) REFERENCES `links_compartilhamento`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`status_id`) REFERENCES `status_board`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `escopo_link_tags` (
	`link_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`link_id`, `tag_id`),
	FOREIGN KEY (`link_id`) REFERENCES `links_compartilhamento`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `links_compartilhamento` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` integer NOT NULL,
	`nome` text NOT NULL,
	`hash_token` text NOT NULL,
	`incluir_arquivadas` integer DEFAULT false NOT NULL,
	`prioridade_minima` integer,
	`prioridade_maxima` integer,
	`expira_em` text,
	`revogado_em` text,
	`ultimo_acesso_em` text,
	`versao` integer DEFAULT 1 NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "links_compartilhamento_nome_valido" CHECK(length(trim("links_compartilhamento"."nome")) > 0 AND length("links_compartilhamento"."nome") <= 120),
	CONSTRAINT "links_compartilhamento_hash_formato" CHECK(length("links_compartilhamento"."hash_token") = 64 AND "links_compartilhamento"."hash_token" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "links_compartilhamento_incluir_arquivadas_booleano" CHECK("links_compartilhamento"."incluir_arquivadas" IN (0, 1)),
	CONSTRAINT "links_compartilhamento_prioridade_minima_intervalo" CHECK("links_compartilhamento"."prioridade_minima" IS NULL OR ("links_compartilhamento"."prioridade_minima" BETWEEN 0 AND 9)),
	CONSTRAINT "links_compartilhamento_prioridade_maxima_intervalo" CHECK("links_compartilhamento"."prioridade_maxima" IS NULL OR ("links_compartilhamento"."prioridade_maxima" BETWEEN 0 AND 9)),
	CONSTRAINT "links_compartilhamento_faixa_prioridade_coerente" CHECK("links_compartilhamento"."prioridade_minima" IS NULL OR "links_compartilhamento"."prioridade_maxima" IS NULL OR "links_compartilhamento"."prioridade_minima" <= "links_compartilhamento"."prioridade_maxima"),
	CONSTRAINT "links_compartilhamento_expira_em_formato" CHECK("links_compartilhamento"."expira_em" IS NULL OR "links_compartilhamento"."expira_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "links_compartilhamento_revogado_em_formato" CHECK("links_compartilhamento"."revogado_em" IS NULL OR "links_compartilhamento"."revogado_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "links_compartilhamento_versao_positiva" CHECK("links_compartilhamento"."versao" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_compartilhamento_hash_token_unico` ON `links_compartilhamento` (`hash_token`);--> statement-breakpoint
CREATE TABLE `tokens_api` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`prefixo` text NOT NULL,
	`hash_token` text NOT NULL,
	`expira_em` text,
	`revogado_em` text,
	`ultimo_uso_em` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "tokens_api_nome_valido" CHECK(length(trim("tokens_api"."nome")) > 0 AND length("tokens_api"."nome") <= 120),
	CONSTRAINT "tokens_api_prefixo_formato" CHECK(length("tokens_api"."prefixo") BETWEEN 4 AND 16),
	CONSTRAINT "tokens_api_hash_formato" CHECK(length("tokens_api"."hash_token") = 64 AND "tokens_api"."hash_token" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "tokens_api_expira_em_formato" CHECK("tokens_api"."expira_em" IS NULL OR "tokens_api"."expira_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'),
	CONSTRAINT "tokens_api_revogado_em_formato" CHECK("tokens_api"."revogado_em" IS NULL OR "tokens_api"."revogado_em" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_api_hash_token_unico` ON `tokens_api` (`hash_token`);--> statement-breakpoint
CREATE TABLE `tokens_api_permissoes` (
	`token_id` integer NOT NULL,
	`permissao` text NOT NULL,
	PRIMARY KEY(`token_id`, `permissao`),
	FOREIGN KEY (`token_id`) REFERENCES `tokens_api`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tokens_api_permissoes_catalogo" CHECK("tokens_api_permissoes"."permissao" IN ('board:ler', 'atividades:ler', 'atividades:escrever', 'anexos:ler', 'anexos:escrever'))
);
