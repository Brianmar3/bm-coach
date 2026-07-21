# BM Coach

## PostgreSQL con Prisma

BM Coach persiste alumnos, pagos, eventos, rutinas, evaluaciones, configuración y clases mediante Prisma y PostgreSQL. Neon y Supabase son compatibles.

1. Copiá `.env.example` como `.env`.
2. Pegá tu cadena real de Neon o Supabase en `DATABASE_URL`.
3. No subas `.env` ni compartas su contenido.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

### Comandos de base de datos

```bash
# Genera el cliente Prisma
npm run prisma:generate

# Desarrollo: crea/aplica una migración nueva desde el esquema
npm run prisma:migrate:dev

# Producción: aplica únicamente las migraciones ya versionadas
npm run prisma:migrate:deploy
```

La migración inicial se encuentra en `prisma/migrations/20260717160000_postgresql_production`. El build ejecuta `prisma generate` y no requiere la URL de la base durante la compilación.

## Desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).
