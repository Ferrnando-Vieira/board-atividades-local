-- Ajustada à mão a partir do drizzle-kit generate, como a 0003: recriar
-- `solicitantes` com foreign_keys ativo esbarraria no RESTRICT de
-- `atividades.solicitante_id`. A coluna entra com ADD COLUMN e CHECK de coluna
-- (as linhas existentes recebem 0).
-- O solicitante padrão deixa de ser um nome fixo no código e passa a ser
-- escolhido na configuração inicial. Em boards criados antes desta versão, o
-- padrão era cadastrado junto com o board, então ele é o solicitante mais
-- antigo de cada board; é esse que fica marcado. Boards novos não têm linhas
-- aqui: o padrão nasce na configuração inicial.
ALTER TABLE `solicitantes` ADD `padrao` integer DEFAULT false NOT NULL CONSTRAINT "solicitantes_padrao_booleano" CHECK("padrao" IN (0, 1));--> statement-breakpoint
UPDATE `solicitantes` SET `padrao` = 1 WHERE `id` IN (SELECT min(`id`) FROM `solicitantes` GROUP BY `board_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `solicitantes_padrao_unico` ON `solicitantes` (`board_id`) WHERE "solicitantes"."padrao" = 1;
