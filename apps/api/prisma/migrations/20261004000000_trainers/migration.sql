CREATE TABLE "entrenadores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "mutacion_cliente_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entrenadores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "entrenadores_mutacion_cliente_id_key" ON "entrenadores"("mutacion_cliente_id");
ALTER TABLE "estudiantes" ADD COLUMN "entrenador_id" TEXT;
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_entrenador_id_fkey"
    FOREIGN KEY ("entrenador_id") REFERENCES "entrenadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
