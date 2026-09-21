# 🤖 Robot Programador

Juego educativo estilo "programá los pasos del robot para llegar a la meta", hecho con
**Next.js (App Router)** y listo para desplegar en **Vercel**.

## ¿Cómo funciona?

s

- **3 niveles** de dificultad creciente: grillas de **3×3**, **4×4** y **5×5** (los dos últimos
  con obstáculos).
- El jugador arma un **programa** con comandos (`Avanzar`, `Girar izquierda`, `Girar derecha`) y
  presiona **Ejecutar** para que el robot 🤖 llegue a la meta 🎯.
- Un **cronómetro** corre de forma continua durante los 3 niveles.
- Al terminar, se muestra el **tiempo total**, se pide **nombre + correo** y se guarda en la base
  de datos. Se calcula en qué **puesto del ranking** quedó el jugador (menor tiempo = mejor).

## Correr en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000

> Sin base de datos configurada, la app funciona igual usando un almacenamiento **en memoria**
> (los registros se pierden al reiniciar el servidor). Perfecto para probar el juego.

## Base de datos (Neon Postgres en Vercel)

En producción los registros se guardan en **Neon** (el Postgres serverless integrado en Vercel).
No hace falta escribir SQL ni crear tablas a mano: la tabla `scores` se crea sola la primera vez.

### Pasos en Vercel

1. Subí el proyecto a Vercel (importalo desde GitHub o con `vercel`).
2. En el dashboard del proyecto entrá a **Storage → Create Database → Neon (Postgres)** y
   conectala al proyecto. Vercel inyecta automáticamente la variable `DATABASE_URL`.
3. Redeploy. Listo: los puntajes se guardan en la base.

### Base de datos en local (opcional)

Si querés usar la base real también en local, copiá `.env.example` a `.env.local` y pegá la
cadena de conexión (`DATABASE_URL`) que te da Neon/Vercel.

## Estructura

```
app/
  page.tsx            → juego completo (grilla, cronómetro, niveles, ranking, formulario)
  layout.tsx          → layout raíz
  globals.css         → estilos
  api/scores/route.ts → API: GET ranking / POST guardar puntaje
lib/
  db.ts               → acceso a Postgres (con fallback en memoria)
```

## Personalización rápida

- **Niveles / dificultad:** editá el array `LEVELS` en [`app/page.tsx`](app/page.tsx) (tamaño de
  grilla, posición de inicio, meta y obstáculos).
- **Velocidad de animación:** el `sleep(360)` dentro de `run()` controla cada paso del robot.
- **Cantidad del top:** el `10` en `getLeaderboard(10)` (en [`lib/db.ts`](lib/db.ts)).
