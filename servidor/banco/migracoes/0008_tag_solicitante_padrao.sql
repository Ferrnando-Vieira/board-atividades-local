-- Ajustada à mão a partir do drizzle-kit generate, que omitiu o ON DELETE da
-- chave estrangeira. Coluna nova e anulável: nenhuma tag existente ganha
-- solicitante padrão, e nenhuma regra fica gravada no código; quem define é o
-- usuário, na tela de Tags ou pela API.
ALTER TABLE `tags` ADD `solicitante_padrao_id` integer REFERENCES `solicitantes`(`id`) ON UPDATE no action ON DELETE set null;
