ALTER TABLE "estudiantes" ADD COLUMN "mutacion_cliente_id" UUID;
CREATE UNIQUE INDEX "estudiantes_mutacion_cliente_id_key" ON "estudiantes"("mutacion_cliente_id");
