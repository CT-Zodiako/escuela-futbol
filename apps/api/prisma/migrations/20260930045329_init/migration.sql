-- CreateTable
CREATE TABLE "administradores" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "contrasena_hash" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudiantes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "mes_activacion" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "estudiante_id" TEXT NOT NULL,
    "fecha_pago" TIMESTAMP(3) NOT NULL,
    "monto" INTEGER NOT NULL,
    "metodo" TEXT NOT NULL DEFAULT 'cash',
    "observacion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "administradores_correo_key" ON "administradores"("correo");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
