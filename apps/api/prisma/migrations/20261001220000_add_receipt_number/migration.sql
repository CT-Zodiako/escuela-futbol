-- AlterTable
ALTER TABLE "pagos" ADD COLUMN "numero_comprobante" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "pagos_numero_comprobante_key" ON "pagos"("numero_comprobante");
