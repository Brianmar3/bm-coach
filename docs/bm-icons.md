# BM Icons

BM Icons es la biblioteca oficial de iconos de BM Training. Centraliza los símbolos de interfaz que se repiten y evita que cada pantalla dibuje una variante distinta del mismo concepto.

> Antes de crear un SVG nuevo, revisar BM Icons.

## Uso

Los componentes se importan desde el único punto público:

```tsx
import { BmBellIcon, BmHomeIcon } from "@/componentes/icons";

<BmHomeIcon />
<BmBellIcon size={20} className="text-yellow-400" title="Notificaciones" />
```

Todos aceptan la misma interfaz:

```ts
type BmIconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
};
```

Los valores predeterminados son `size={24}` y `strokeWidth={1.8}`. Todos usan `viewBox="0 0 24 24"`, `fill="none"`, `currentColor`, extremos redondos y uniones redondas.

Sin `title` el icono es decorativo (`aria-hidden`). Con `title` se expone como imagen accesible. Si el icono está dentro de un botón, el nombre accesible debe estar en el botón mediante texto o `aria-label`.

## Convenciones

- 16 px: información muy compacta.
- 20 px: filas, botones y acciones secundarias.
- 24 px: tamaño estándar y navegación.
- 28–32 px: accesos destacados.
- 40 px o más: estados vacíos o logros, con moderación.
- Dorado: identidad y acciones BM.
- Blanco: contenido principal.
- Gris: estado secundario, inactivo o deshabilitado.
- Verde: éxito o completado.
- Rojo: error, alerta o acción destructiva.

El color se controla desde `className`; el componente nunca fija un color de producto. No se deben usar emojis o caracteres Unicode como reemplazo de un icono de interfaz.

## Catálogo V1

- Navegación: inicio, clases, rutina, nutrición, evaluación y perfil.
- Cuenta y ajustes: configuración, notificaciones, seguridad, privacidad, preferencias, ayuda y cerrar sesión.
- Acciones: agregar, editar, volver, siguiente, cerrar, eliminar, buscar, filtrar, más, copiar, confirmar y visibilidad.
- Progreso: ranking, puntos, trofeo, medalla, corona, asistencia, calendario, pagos, objetivo, progreso, historial y gráficos.
- Entrenamiento: mancuerna/barra, cronómetro, desafío, registro, fuego/racha, peso, medidas, salud e hidratación.
- Contacto e información: teléfono, correo e información.

El catálogo y sus nombres exportados viven en [`componentes/icons/bm-icons.tsx`](../componentes/icons/bm-icons.tsx). El barrel [`componentes/icons/index.ts`](../componentes/icons/index.ts) es la única ruta pública recomendada.

## Cómo extender la biblioteca

1. Buscar primero el concepto o uno semánticamente equivalente en `@/componentes/icons`.
2. Si no existe, confirmar que será reutilizable y no una ilustración o gráfico específico de una pantalla.
3. Agregarlo con el prefijo `Bm`, sufijo `Icon` y la geometría normalizada de 24 × 24.
4. Usar el helper interno `createBmIcon` para conservar accesibilidad y estilo.
5. Exportarlo desde el catálogo; el barrel ya reexporta el archivo.
6. Actualizar esta documentación y las pruebas estructurales.

No pertenecen a BM Icons los logos, avatares, imágenes de ejercicios, body maps, gráficos de datos ni ilustraciones complejas. Esos recursos mantienen sus componentes o assets especializados.

## Migración gradual

V1 migra solamente superficies repetidas y de bajo riesgo. Los componentes especializados se conservan hasta que exista una revisión visual y funcional específica. `componentes/settings-icons.tsx` queda como adaptador compatible, pero sus dibujos ya provienen de BM Icons: no es una segunda fuente de SVG.
