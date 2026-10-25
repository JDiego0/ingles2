# English Journey — de A1 a B2

Aplicación web personal (PWA) para aprender inglés estadounidense desde A1/A1+ hasta competencias cercanas a B2, en sesiones de unos 30 minutos, pensada para usarse desde el celular Android.

El objetivo no es completar ejercicios, sino **poder producir el idioma sin pistas**: comprender una expresión, escucharla, recuperarla de memoria, usarla en frases propias y en conversaciones, y recordarla días después.

> La app estima tu progreso con evidencias, pero **no certifica oficialmente un nivel MCER**. Las conversaciones son **diálogos ramificados predefinidos, no inteligencia artificial**.

---

## Qué incluye

| Área | Contenido |
|---|---|
| Ruta | 4 etapas (A1 · A2 · B1 · B2), **19 módulos, 38 unidades, 76 lecciones completas** con prerrequisitos |
| Chunks | **376 expresiones** (A1: 96 · A2: 114 · B1: 86 · B2: 80), cada una con significado, ejemplo, variantes para sustituir piezas, error frecuente de hispanohablantes, pregunta de recuperación y tarea de producción |
| Ejercicios escritos | 933 (más los que el motor genera a partir de cada chunk) |
| Evaluaciones | Diagnóstico inicial (15 preguntas, con respuestas abiertas), evaluación por unidad, evaluación acumulativa por módulo y evaluación acumulativa general |
| Conversación | 11 situaciones ramificadas (conocer a alguien, rutinas, cafetería, soporte técnico, planes, llamada, stand-up, decisión profesional, entrevista, defender una opinión, explicar un incidente) |
| Pronunciación | 8 grupos de pares mínimos para hispanohablantes, 14 ejercicios de ritmo/contracciones, dictados con tus propias expresiones |

### Cada lección (≈ 30 min, sin cronómetro rígido)

1. **Calentamiento** — recuperas de memoria 3–5 expresiones anteriores (primero las vencidas).
2. **Comprensión** — escuchas una situación real sin texto, respondes preguntas de idea general y luego ves transcripción y traducción bajo demanda.
3. **Expresiones nuevas** — 3–5 chunks: significado, audio, ejemplo, sustitución de piezas, error frecuente y comprobación.
4. **Recuperación activa** — del significado al inglés, completar, reconstruir tras escuchar, responder preguntas que exigen la expresión.
5. **Producción libre** — hablas o escribes con tus palabras; no hay modelo visible.
6. **Evaluación y cierre** — preguntas nuevas, tu **pequeña victoria** (decir algo útil sin guion) y un resumen: qué recuperaste, qué necesitó pista, qué falta, errores a corregir y qué repasarás mañana.

### Ayuda progresiva (nunca «Siguiente» gratis)

Intentas → pista pequeña (primeras letras) → ayuda mayor (mitad de la frase) → modelo → **lo vuelves a escribir sin verlo**. La pista solo aparece después de un intento o de unos segundos.

### Dominio real

Cada intento se clasifica: *fallo · reconoce · con pista · sin ayuda · espontáneo*. La opción múltiple nunca hace avanzar el calendario más allá del paso 1. Una expresión solo se marca **«dominada provisionalmente»** si se produjo sin ayuda varias veces, al menos una de forma espontánea, en contextos distintos (producción, conversación, evaluación…) y con un intervalo de repaso de 14 días o más.

Calendario base de repaso: mismo día → 1 → 3 → 7 → 14 → 30 días (después 60 y 120), ajustado con un factor de facilidad. Si fallas, la expresión vuelve en minutos y retrocede dos pasos.

### Progreso por competencias

Comprensión auditiva, lectura, expresión oral, escritura, vocabulario, gramática aplicada y fluidez se miden por separado (media ponderada de los últimos intentos sin ayuda). Hay gráficos por semana, historial de evaluaciones, errores frecuentes detectados, «Antes podía / Ahora puedo» con tus propias producciones, logros basados en competencias y descriptores MCER (orientativos) trabajados.

El nivel estimado parte del diagnóstico y **solo sube cuando apruebas todas las evaluaciones de módulo de una etapa**. Nunca se calcula con puntos, rachas o lecciones visitadas.

### Instrucciones en español → inglés

En modo «Progresivo» (por defecto): etapa A en español, etapa B bilingüe, etapas C y D en inglés con botón «Ver en español». Se puede fijar en Ajustes.

---

## Tecnología

- React 19 + TypeScript + Vite 8 (sin backend, sin API keys, sin cuentas).
- CSS propio con tokens (modo claro/oscuro, mobile-first). Router propio por hash (funciona en GitHub Pages).
- Web Speech API: síntesis de voz (en-US) y reconocimiento cuando el navegador lo ofrece; si no, grabación local con MediaRecorder o respuesta escrita.
- PWA: `manifest.webmanifest`, iconos y service worker generado en cada build con la lista exacta de archivos y una versión por contenido (las cachés antiguas se borran al activar la nueva versión; la app avisa «Hay una versión nueva» en lugar de recargar a mitad de una lección).
- Progreso en `localStorage` con validación, migración, exportación/importación JSON y pantalla de recuperación si los datos se dañan. Varias pestañas abiertas no se pisan entre sí.
- Vitest: 69 pruebas (validación de respuestas, repetición espaciada, almacenamiento, desbloqueo, detector de errores, motor de lecciones, conversación, diagnóstico e integridad de todo el contenido).

## Estructura

```
src/
  types/          Tipos del contenido y del progreso
  content/        Contenido educativo (no depende de la UI)
    modules/      a1…a5, b1…b6, c1…c4, d1…d4 (chunks + módulo con unidades y lecciones)
    course.ts     Índice del curso: añade aquí nuevos módulos
    diagnostic.ts conversations*.ts pronunciation.ts descriptors.ts
  engine/         Lógica pura y probada
    answer.ts     Validación flexible (contracciones, variantes, comodines, erratas)
    srs.ts        Repetición espaciada y dominio
    lessonPlan.ts Motor de las 6 fases
    generate.ts   Ejercicios generados desde cada chunk
    unlock.ts     Prerrequisitos y siguiente paso
    stats.ts      Competencias, racha flexible, nivel estimado, recomendaciones, logros
    errors.ts     Detector de errores frecuentes de hispanohablantes
    conversation.ts diagnostic.ts progress.ts instructions.ts
  storage/        localStorage: validación, migración, copias de seguridad
  speech/         Síntesis, reconocimiento y grabación de voz
  state/          Contexto de React con el progreso
  components/     UI reutilizable y ejercicios
  screens/        Pantallas
tests/            Pruebas (Vitest)
scripts/          Generador de iconos
.github/workflows/deploy.yml  Despliegue a GitHub Pages
```

---

## Uso local

Requisitos: Node.js 20.19+ (o 22.12+) y npm.

```bash
npm install          # instalar dependencias
npm run dev          # servidor de desarrollo (http://localhost:5173)
npm test             # pruebas
npm run build        # comprobación de tipos + compilación en dist/
npm run preview      # servir dist/ (http://localhost:4173) — aquí sí funciona el modo sin conexión
```

El service worker solo se registra en la versión compilada (`build`/`preview` o GitHub Pages), no en `npm run dev`.

---

## Publicar en GitHub Pages (gratis)

### 1. Crear el repositorio y subir el proyecto

1. En GitHub: **New repository** → nombre, por ejemplo, `english-journey` → público → **sin** README (ya existe) → Create.
2. En la carpeta del proyecto:

   ```bash
   git remote add origin https://github.com/TU_USUARIO/english-journey.git
   git push -u origin main
   ```

   (Con GitHub CLI: `gh repo create english-journey --public --source . --push`.)

No subas tokens ni contraseñas: el proyecto no necesita ninguno.

### 2. Activar GitHub Pages

1. En el repositorio: **Settings → Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Cada `push` a `main` ejecuta `.github/workflows/deploy.yml`: instala, **ejecuta las pruebas**, compila y publica `dist/`. Si una prueba falla, no se publica.
4. Comprueba el avance en la pestaña **Actions**. Al terminar, la dirección aparece en Settings → Pages (normalmente `https://TU_USUARIO.github.io/english-journey/`).

La app usa rutas relativas (`base: './'` y rutas con `#`), así que funciona con cualquier nombre de repositorio.

### 3. Abrir en Android

1. Abre la dirección de GitHub Pages en **Chrome para Android**.
2. Haz el diagnóstico o empieza desde el principio.

### 4. Instalar en la pantalla de inicio

1. En Chrome, menú **⋮ → Instalar aplicación** (o «Agregar a pantalla principal»).
2. Se abrirá a pantalla completa, como una app.
3. Ábrela una vez con conexión para que se guarden todos los archivos; después funciona sin conexión.

---

## Limitaciones conocidas (importante)

**Sin conexión**
- Funcionan sin internet: lecciones, repasos, biblioteca, conversaciones, evaluaciones y progreso, una vez que la app se abrió con conexión.
- Las actualizaciones llegan la próxima vez que abras la app con conexión; la app pregunta antes de actualizar.

**Voz**
- La síntesis de voz depende del dispositivo. En Android: Ajustes → Sistema → Idioma → Salida de texto a voz → instala *Inglés (Estados Unidos)* en «Síntesis de voz de Google» (permite usarla sin conexión). Puedes elegir voz y velocidad en Ajustes.
- El **reconocimiento de voz** (responder hablando) funciona en Chrome para Android, pero **normalmente necesita internet** porque el audio se procesa en servidores del navegador. Sin conexión o en navegadores sin soporte, la app ofrece grabarte y escucharte, o responder por escrito.
- La transcripción solo indica qué palabras reconoció el navegador: **no evalúa tu pronunciación** en detalle ni la app lo afirma.

**Corrección automática**
- Las respuestas cerradas aceptan variantes (contracciones, puntuación, mayúsculas, sinónimos previstos, pequeñas erratas).
- En producción libre la app revisa longitud, uso de las expresiones del curso y ~25 errores frecuentes de hispanohablantes. **No sustituye a un profesor**: compara con el ejemplo y usa la autoevaluación.

**Datos**
- El progreso se guarda **solo en este navegador**. No se sincroniza entre dispositivos y se pierde si borras los datos del navegador. Usa **Ajustes → Exportar** con regularidad e **Importar** para restaurar (se valida antes de reemplazar).

---

## Ampliar el contenido

1. Crea `src/content/modules/xx.ts` siguiendo el formato de los existentes (`chunks` + `mod`).
2. Añádelo en `src/content/course.ts` (lista `MODULE_FILES`, en orden de la ruta) con su prerrequisito.
3. Ejecuta `npm test`: las pruebas de contenido detectan ids duplicados, referencias inexistentes, preguntas sin respuesta válida, lecciones incompletas, plantillas mal formadas y ejemplos que no contienen su expresión.

Sintaxis de respuestas aceptadas: `{a|b}` alternativas, `(x)` opcional, `*` cualquier texto, `#` un número. Ej.: `"I'm # years old"`, `"Could you repeat that(, please)?"`.

El objetivo de diseño de la biblioteca es ~600 chunks; la versión actual tiene 376 revisados uno a uno, priorizando calidad y reutilización. Se puede ampliar por lotes sin tocar la interfaz.
