# English Journey — de A1 a B2

Aplicación web personal (PWA) para aprender inglés estadounidense desde A1/A1+ hasta competencias cercanas a B2, en sesiones de unos 30 minutos, pensada para usarse desde el celular Android.

El objetivo no es completar ejercicios, sino **poder producir el idioma sin pistas**: comprender una expresión, escucharla, recuperarla de memoria, usarla en frases propias y en conversaciones, y recordarla días después.

> La app estima tu progreso con evidencias, pero **no certifica oficialmente un nivel MCER**. Las conversaciones son **diálogos ramificados predefinidos, no inteligencia artificial**.

---

## Qué incluye

| Área | Contenido |
|---|---|
| Ruta | 4 etapas (A1 · A2 · B1 · B2), **19 módulos, 38 unidades, 76 lecciones completas** con prerrequisitos |
| Chunks | **603 expresiones** (A1: 151 · A2: 174 · B1: 142 · B2: 136): 376 enseñadas en las lecciones y 227 extra en la biblioteca, cada una con significado, ejemplo, variantes para sustituir piezas, error frecuente de hispanohablantes, pregunta de recuperación y tarea de producción |
| Ejercicios escritos | 933 (más los que el motor genera a partir de cada chunk) |
| Evaluaciones | Diagnóstico inicial (15 preguntas, con respuestas abiertas), evaluación por unidad, evaluación acumulativa por módulo y evaluación acumulativa general |
| Conversación | 12 situaciones ramificadas (conocer a alguien, rutinas, cafetería, soporte técnico, planes, llamada, stand-up, decisión profesional, entrevista, defender una opinión, explicar un incidente) |
| Pronunciación | 8 grupos de pares mínimos para hispanohablantes, 14 ejercicios de ritmo/contracciones, dictados con tus propias expresiones |

### Cada lección (≈ 30 min, sin cronómetro rígido)

1. **Calentamiento** — recuperas de memoria 3–5 expresiones anteriores (primero las vencidas).
2. **Comprensión** — escuchas una situación real sin texto, respondes preguntas de idea general y luego ves transcripción y traducción bajo demanda.
3. **Expresiones nuevas** — 3–5 chunks: significado, audio, ejemplo, sustitución de piezas, error frecuente y comprobación.
4. **Recuperación activa** — del significado al inglés, completar, reconstruir tras escuchar, responder preguntas que exigen la expresión.
5. **Producción libre** — hablas o escribes con tus palabras; no hay modelo visible.
6. **Evaluación y cierre** — preguntas nuevas, tu **pequeña victoria** (decir algo útil sin guion) y un resumen: qué recuperaste, qué necesitó pista, qué falta, errores a corregir y qué repasarás mañana.

### Responder sin teclado

Por defecto respondes **hablando** (botón grande «Responder hablando») o **formando la frase con bloques** (con 1–2 bloques que sobran). El teclado queda como opción («Escribir») en cada ejercicio, o como modo por defecto en **Ajustes → Cómo responder**. Formar la frase con bloques cuenta como «con ayuda»: para dominar una expresión hay que decirla sin ayuda.

En la producción libre, la victoria y las conversaciones, cada vez que pulsas el micrófono se añade lo que dijiste; puedes quitar lo último o borrar.

### Ayuda progresiva (nunca «Siguiente» gratis)

Intentas → pista pequeña (primeras letras) → ayuda mayor (mitad de la frase) → modelo → **la vuelves a decir (o formar) sin verla**. La pista solo aparece después de un intento o de unos segundos.

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
- Voz natural pregrabada: todas las frases del curso están grabadas con una voz neuronal femenina (Kokoro, Apache 2.0) en `public/audio/`. Se descargan al escucharlas y quedan guardadas para usarlas sin conexión. Si falta alguna, se usa la síntesis del navegador.
- Reconocimiento de voz en el teléfono: Whisper Base en inglés (MIT) con transformers.js en un Web Worker. Graba con un solo micrófono abierto hasta pulsar «Listo» y luego transcribe; el modelo (~140 MB) se descarga una vez, con permiso, y después funciona sin conexión.
- Velocidad: el codificador de Whisper corre en la tarjeta gráfica (WebGPU) si el teléfono lo permite y el decodificador en el procesador con varios núcleos. GitHub Pages no deja poner cabeceras, así que el service worker añade `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy: credentialless` para activar el aislamiento que permite los hilos. El modelo se carga y precalienta al abrir la app si ya está descargado; Ajustes → Micrófono muestra dónde corre y cuánto tardó la última transcripción.
- Ayudas de contexto (`src/speech/vocab.ts`): el vocabulario de la lección o la conversación, tu nombre, las ciudades de Colombia y las palabras de Ajustes → Micrófono se le pasan a Whisper como pista, y después lo que suena parecido a una palabra esperada se corrige («medicine» → «Medellín»). Las palabras muy frecuentes no se cambian.
- Web Speech API: síntesis de voz de respaldo (en-US) y reconocimiento de Chrome como alternativa (Ajustes → Micrófono); si no hay ninguno, grabación local con MediaRecorder o respuesta escrita.
- Lo que entiende el reconocedor siempre se puede corregir escribiendo antes de comprobar o enviar.
- Sonidos propios de acierto, error y micrófono, sintetizados con Web Audio (se pueden desactivar).
- PWA: `manifest.webmanifest`, iconos y service worker generado en cada build con la lista exacta de archivos y una versión por contenido (las cachés antiguas se borran al activar la nueva versión; la app avisa «Hay una versión nueva» en lugar de recargar a mitad de una lección).
- Progreso en `localStorage` con validación, migración, exportación/importación JSON y pantalla de recuperación si los datos se dañan. Varias pestañas abiertas no se pisan entre sí.
- Vitest: 88 pruebas (validación de respuestas, reconocimiento de voz sin duplicados ni reinicios, preparación de la grabación, audio sin reproducciones dobles, repetición espaciada, almacenamiento, desbloqueo, detector de errores, motor de lecciones, conversación, diagnóstico e integridad de todo el contenido).

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
- Con la voz «Natural» (predeterminada) el audio suena igual en todos los dispositivos. Si cambias o añades frases al contenido, regenera el audio: `node scripts/audio-corpus.mjs` y luego `python scripts/make-audio.py --models <carpeta>` (instrucciones al inicio del script; solo genera lo que falta).
- Las voces del sistema dependen del dispositivo. En Android: Ajustes → Sistema → Idioma → Salida de texto a voz → instala *Inglés (Estados Unidos)* en «Síntesis de voz de Google» (permite usarla sin conexión). Puedes elegir voz y velocidad en Ajustes.
- El **reconocimiento de voz** (responder hablando) funciona por defecto **dentro del teléfono**: la primera vez pide permiso para descargar el modelo (~140 MB, mejor con Wi-Fi) y después funciona sin internet. Tarda uno o dos segundos en transcribir al pulsar «Listo». El reconocimiento de Chrome sigue disponible en Ajustes → Micrófono (necesita internet y en Android se corta en las pausas). Sin ninguno de los dos, la app ofrece grabarte y escucharte, o responder por escrito.
- El micrófono **sigue escuchando hasta que pulsas «Listo»**, aunque hagas pausas para pensar (el navegador corta al detectar silencio y la app vuelve a escuchar sola; en algunos Android suena un pitido al reanudar).
- Chrome para Android repite fragmentos del reconocimiento («hello hello my…»); la app reconstruye el texto y elimina repeticiones. Entre las interpretaciones posibles prefiere la que coincide con la respuesta esperada o contiene tu nombre.
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

Las expresiones extra viven en `src/content/library/` (un lote por etapa) y se asignan a un módulo; la interfaz no cambia al ampliarlas.
