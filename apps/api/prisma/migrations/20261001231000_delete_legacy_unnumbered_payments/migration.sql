-- Development cleanup: every current payment must have a manually assigned receipt number.
DELETE FROM "pagos"
WHERE "numero_comprobante" IS NULL;
