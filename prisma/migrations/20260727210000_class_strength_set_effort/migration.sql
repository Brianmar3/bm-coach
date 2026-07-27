-- RIR/esfuerzo opcional para series de bloques de fuerza presenciales.
-- La columna es nullable para mantener compatibles todos los registros existentes.
ALTER TABLE "class_set_logs"
ADD COLUMN "effort" DECIMAL(4, 1);
