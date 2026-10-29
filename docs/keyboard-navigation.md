# Navegación por teclado de BM Training

## Auditoría y criterios

Se revisaron los buscadores y listas de alumnos, pagos, asistencias, horarios, rutinas, ejercicios, biblioteca, evaluaciones, membresías, menús, modales y filtros. Los comportamientos compartibles se agruparon en cuatro patrones: combobox editable, selección múltiple, resultados con acciones nativas y capas de menú/diálogo. Se conservaron los selectores HTML, los editores de rutinas y los atajos de BM Command.

La implementación es local a cada componente o al contenido de `ModuleShell`. No se agregó un listener global de flechas o Enter. La pila existente de Escape continúa siendo la única coordinación global de capas.

## Pantallas migradas

| Área | Cobertura |
| --- | --- |
| Alumnos | Buscar y recorrer resultados para abrir la ficha; alta manual y edición; ficha; elección de alta e invitación; fechas; selector múltiple de horarios. Se conserva el debounce y la búsqueda existente. |
| Asistencias | Buscar alumno activo y agregarlo excepcionalmente con flechas y Enter. Escape cierra las sugerencias y después el panel de agregar. El roster conserva sus flechas y atajos existentes. El detalle del historial semanal agrega foco, Tab y Escape. |
| Pagos | Buscar y recorrer cuentas; selector de alumnos; carga y edición del pago; historial; menú de acciones con flechas, Home/End, Tab y Escape. Se conserva el avance previsto hacia el importe después de elegir al alumno. |
| Rutinas | Resultados principales; asignaciones múltiples desde edición, administrar asignaciones y usar plantilla; selector de origen de nueva rutina y resultados de clases/rutinas; diálogos de copia, asignación y elección de base. Se conserva la lógica de selección y guardado. |
| Editores y planificación de clases | Asignación múltiple en horarios con respeto del cupo; modales de creación/edición y detalle del horario; configuración de la ocurrencia concreta; editor de clase completa; edición/guardado de bloques. Los controles propios del editor conservan sus atajos. |
| Biblioteca de bloques | Buscar y abrir bloques; selector de bloques para agregar; carpetas y eliminación de bloques; navegación entre acciones sin entrar en controles de edición. |
| Biblioteca de ejercicios | Desde el buscador, flechas llevan a los resultados y Enter abre el mismo detalle que el clic. El detalle recibe foco en Volver; volver o agregar en el panel integrado devuelve el foco al buscador. Favoritos, Agregar y Seleccionar mantienen sus acciones habituales con Tab y Enter. |
| Evaluaciones | Directorio de alumnos y acción principal; menú de cada evaluación; diálogos de detalle/eliminación; panel y asistente de evaluación. Escape del asistente utiliza el mismo cierre con guardado existente y respeta el guardado en curso. |
| Master | Gestión de membresías e invitación: foco, Tab, Escape y prevención de submit accidental. Listado de entrenadores: buscar, flechas hacia enlaces Ver y Enter nativo. Pestañas Cuentas/Invitaciones con flechas horizontales. |
| Filtros compartidos | `SearchWithFilters` cierra primero el panel con Escape y vuelve a su botón. `TrainerFilters` conserva los selects nativos y sus teclas habituales. |
| BM Command | Conserva Ctrl/Cmd+K, `/`, atajos, prioridad y recorrido existentes. Se completaron los atributos del combobox, visibilidad del resultado activo y protección durante composición de texto. |

## Teclas y foco

- En los combobox, escribir muestra coincidencias sin seleccionar ninguna automáticamente. ↓ activa la primera opción habilitada; ↑ desde ninguna activa la última. Las flechas se detienen en los extremos y omiten opciones deshabilitadas. Enter selecciona únicamente una opción activa válida mediante el mismo callback que el clic. Enter sin coincidencias, sin opción activa o con la lista cerrada no envía el formulario.
- La opción activa usa `aria-activedescendant` y un resaltado de foco. El input conserva el foco. Cambiar la búsqueda, retirar una opción o deshabilitarla invalida la opción activa anterior.
- Las listas múltiples usan `aria-multiselectable` y `aria-selected` para la selección. Enter alterna la misma selección que el clic y conserva la búsqueda. Los límites de cupo siguen viniendo de la lógica existente.
- Tab y Shift+Tab cierran sugerencias sin cancelar el desplazamiento de foco nativo. Los modales contienen Tab entre sus controles visibles y habilitados, y devuelven el foco al disparador al cerrarse. Un modal ocupado consume Escape sin cerrar la capa inferior ni sacar el foco afuera.
- Los resultados con varias acciones no se convierten en falsos listbox: las flechas llevan el foco a botones reales. Enter usa su activación nativa. Los menús usan `menu`/`menuitem`, omiten opciones deshabilitadas, recorren en ciclo y soportan Home/End.
- Escape cierra una sola capa: sugerencias o filtro/menú antes del diálogo. Los desplegables `details` vuelven a su `summary`. Los select y datalist conservan Escape nativo. BM Command mantiene prioridad 100 sobre las capas de trabajo.
- No se interceptan flechas dentro de otros textos, textarea, fechas, números, select o contenido editable. Los selectores propios declaran `data-keyboard-owned` para que el editor de rutinas les ceda las teclas. Se respeta IME, modificadores y se evita repetir una selección por mantener Enter presionado.
- El resaltado compartido sólo agrega indicadores de foco y opción activa. El desplazamiento de sugerencias se limita a su contenedor; las flechas de la página siguen funcionando fuera de los componentes habilitados.

## Componentes reutilizables

- `useComboboxNavigation`: IDs ARIA, opción activa por clave estable, apertura/cierre, navegación, selección y scroll del panel. Desestructurar `attachRoot`, `attachList` y `attachInput` antes de pasar los callbacks a `ref`; los datos y propiedades del control permanecen independientes de las referencias DOM.
- `StudentAssignmentOptions`: presentación común de selección múltiple de alumnos. Recibe resultados, selección, callbacks y disponibilidad; no implementa reglas comerciales ni cambia las búsquedas.
- `KeyboardResults` / `useResultNavigation`: ámbito local con opt-in explícito. Marcar el buscador con `data-keyboard-results-search` y la acción principal de cada resultado con `data-keyboard-result`. Los demás controles siguen siendo nativos. `ModuleShell` incorpora este ámbito sin agregar disposición visual.
- `KeyboardDialog` / `useDialogKeyboard`: foco inicial, restauración, Tab, capa de Escape y prevención de submit implícito en campos de una línea. Acepta los elementos `div`, `section` y `form` para conservar la estructura. Los callbacks de cierre y confirmación siguen perteneciendo a cada pantalla.
- `KeyboardMenu` / `useMenuNavigation`: navegación de acciones habilitadas y devolución al disparador. Las variantes responsive ocultas no registran una capa activa.
- `lib/keyboard-navigation.ts`: recorrido de claves, controles disponibles, visibilidad de opciones y cierre de `details`.

## Segunda revisión: cobertura final (29/10/2026)

| Área | Cobertura y criterio |
| --- | --- |
| Portal del alumno | Eventos: diálogo compartido con foco y retorno al disparador. Ajustes de cuenta: popover no modal con foco inicial, Escape y restauración; Tab puede salir. Transferencias: manejo compartido de capas y Tab, conservando selección bancaria y copia. Entrenamiento: modo enfoque coordina Escape con las capas superiores; ventanas de entrada en calor y demás RoutineOverlay contienen Tab y restauran foco. |
| Notificaciones de alumno y entrenador | Popover no modal recibe foco al estar posicionado. Tab llega a las acciones y avisos; ↑/↓ y Home/End recorren botones de avisos. Enter conserva la acción de clic. Confirmar borrado contiene Tab, comienza en Cancelar y devuelve foco a Borrar todo; Escape cierra sólo la confirmación y luego el popover. Durante borrado no cierra otra capa. |
| Duplicados | Diálogo con foco inicial y retorno. Confirmación anidada de eliminación con prioridad propia, Cancelar como foco inicial y protección mientras trabaja. Checkbox, Conservar y Archivar conservan interacción nativa; no se agregan flechas que cambien la rutina principal. |
| Eventos | Buscador con nombre accesible y flechas hacia Ver en lista/calendario. Crear/editar y detalle usan diálogos compartidos. Enter en texto no guarda; Guardar se activa desde su botón. |
| Configuración | Formularios de entrenador y Master evitan submit implícito desde texto. Tab/Shift+Tab y botón Guardar nativos. |
| Seguimiento | Buscador y acciones Ver seguimiento con recorrido de resultados. Drawer, sesión y confirmación de eliminación con prioridades separadas, foco y Tab. Pestañas Resumen/Sesiones/Progreso/Molestias con ←/→, Home/End y selección automática. |
| Resumen mensual | Flechas desde búsqueda hacia el detalle de alumno en tabla o tarjetas visibles. El detalle sigue siendo una sección en línea, sin modalizar la pantalla: recibe foco, Escape cierra y devuelve foco; Tab continúa normalmente. |
| Master | Ámbito local de resultados en PlatformShell, listado de entrenadores, pestañas e invitación. Detalle de membresías mantiene el comportamiento de la primera implementación. Filtros y acciones restantes siguen siendo botones y enlaces nativos. |
| Mapa corporal | Diálogo con retención/restauración de foco y una capa de Escape. Pestañas anterior/posterior con ←/→, Home/End y ARIA tab/tabpanel. El SVG es informativo: no tiene acciones por región; los datos de series y porcentajes están en Distribución semanal. |

Los flujos de alumnos, clases, asistencias, pagos, asignación de rutinas y búsqueda de ejercicios conservan la primera implementación descrita arriba. Los callbacks comerciales no se sustituyen: botones y opciones activan las mismas funciones desde clic, toque o teclado.

## Controles que conservan navegación nativa

- Texto y textarea: edición, selección, flechas del cursor y saltos de línea. No se reasignan flechas de editores de rutinas o notas.
- Select, datalist, fechas, horas, números, colores y archivos: interacción propia del navegador. Escape dentro de select/datalist se reserva para su desplegable.
- Checkbox, botones de hábitos/nutrición, filtros de estado y acciones independientes: Tab/Shift+Tab, Espacio o Enter según el control. No constituyen listas de selección con flechas.
- Gráficos, resúmenes y mapa SVG informativo: lectura con texto equivalente, sin inventar acciones.
- Celebración: conserva dialog nativo, showModal, foco y evento cancel. La pila de Escape respeta dialog abierto, evitando cerrar una capa inferior.
- Details: activación de summary y Tab nativos; los ámbitos compartidos cierran primero el desplegable con Escape y vuelven a summary.

No hay un controlador global de flechas ni Enter. Las pestañas horizontales dejan ↑/↓ al desplazamiento normal. BM Command conserva sus atajos y prioridad 100. Los popovers no modales no atrapan Tab.

## Pruebas y límites

Las pruebas de interfaz ejecutan React, JSDOM y eventos de usuario; la geometría se simula porque JSDOM no calcula layout. Cubren selección de alumnos, cupo, búsqueda cambiante, editor, ejercicios reales, foco, Tab, Escape, modales ocupados, IME, controles nativos y paridad clic/Enter. La segunda revisión agrega componentes reales de mapa corporal, revisión de duplicados y notificaciones, pestañas y convivencia con dialog nativo. Las API se simulan; no se registran pagos/asistencias ni se eliminan rutinas/notificaciones reales.

No se realizó una sesión manual autenticada con datos de alumnos ni se dispone de comprobación física táctil o con lector de pantalla. Queda recomendada esa validación de aceptación en los dispositivos habituales; no se afirma compatibilidad validada con todos los lectores de pantalla. Nutrición, gráficos, tarjetas informativas y controles especializados conservan los patrones nativos indicados y no se presentan como listbox artificiales.

Resultado: npm test aprueba 1.004 pruebas (153 de pretest + 851 de la suite principal); test:keyboard aprueba 40 (23 de interfaz). Lint de los archivos del cambio: 0 errores y advertencias. Lint global: 0 errores y 34 advertencias en artefactos nativos generados y scripts ajenos. Build Next.js de producción: correcto, 82 páginas estáticas, usando conexión ficticia y correos desactivados. El chequeo global independiente de TypeScript conserva los 53 errores previos que se detallan debajo.

## Diagnóstico de validaciones previas

El inventario anterior a esta segunda revisión está en [keyboard-validation-before.json](keyboard-validation-before.json). Había 53 errores de TypeScript, todos en tests; el resultado final conserva los mismos diagnósticos. Las fuentes de aplicación no agregan errores.

47 coinciden por archivo, código y mensaje con routine-typecheck.tmp.txt, registro del 10/10/2026. Los otros seis ya estaban al comenzar esta revisión: cuatro en exercise-library-custom.test.ts por NODE_ENV inferido como string incompatible con ProcessEnv, y dos en payment-void-order.test.ts por acceder a createdAt sin estrechar una unión. Esos dos archivos de tests no difieren de HEAD. No hay evidencia de que los cause la navegación. No se corrigieron tipos ni reglas ajenas.

Las dos fallas de students-mobile-list.test.ts son expectativas de código fuente anteriores: exige pb-20 mientras la vista ya usa pb-3, y textos completos de opciones que hoy se componen en el filtro compartido. Ambas diferencias también existen en HEAD. Se mantienen sin modificar estilos, filtros ni tests móviles.

Las comprobaciones antiguas que exigían listeners locales de Escape o diálogos dentro del archivo del padre se actualizaron a los componentes reutilizados, acompañadas por pruebas de eventos reales. La suite general inicialmente encontró EPERM al renombrar fixtures en temporales del sandbox; repetir con TEMP y TMP apuntando a .keyboard-test-tmp dentro del proyecto elimina esa limitación, sin cambiar esos tests ni los datos de aplicación.

Todos los cambios están en C:\bmcoach-local. Sin cambios en BM-Timer, sin migraciones ni operaciones en producción, sin commit ni push.
