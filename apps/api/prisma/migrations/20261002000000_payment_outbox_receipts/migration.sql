BEGIN;

-- Block legacy writers while initializing from existing numbered receipts.
LOCK TABLE "pagos" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "pagos" ADD COLUMN "mutacion_cliente_id" TEXT;
CREATE UNIQUE INDEX "pagos_mutacion_cliente_id_key" ON "pagos"("mutacion_cliente_id");

CREATE TABLE "receipt_counter" (
    "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
    "value" INTEGER NOT NULL CHECK ("value" >= 0)
);
INSERT INTO "receipt_counter" ("id", "value")
SELECT 1, GREATEST(COALESCE(MAX("numero_comprobante"), 0), 0) FROM "pagos";

COMMIT;
