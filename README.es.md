# Quimun · Inteligencia de portafolio

Monitoreo de uso y engagement de las residencias que operan sobre
[Quimun](https://quimun.com/) — el SaaS vertical para ELEAM y residencias de
adultos mayores en Chile.

> **English:** [`README.md`](README.md) · **Guion de demo:** [`DEMO.md`](DEMO.md)

Construido sobre el brief: Raimundo mantiene un canal de WhatsApp con cada una
de las +60 residencias y las monitorea a mano. La plataforma ya registra quién
usa qué. El cuello de botella es tiempo de desarrollo. Este es el dashboard que
su equipo tendría que construir internamente.

---

## Qué responde

El brief plantea cinco preguntas. Cada una tiene un lugar concreto acá:

| La pregunta | Dónde se responde |
|---|---|
| ¿Cuánto usa cada residencia Quimun? | **Índice de uso** — cuatro componentes, normalizado contra pares del mismo tamaño |
| ¿Qué módulos están usando? | **Módulos** — matriz de adopción de 64 residencias × 12 módulos reales |
| ¿Dónde está cayendo el uso? | Tendencia 28d, detector de cambio de nivel y proyección a 30 días |
| ¿Qué clientes necesitan atención? | **Señales** — 11 reglas, ordenadas por severidad, ingreso en juego y probabilidad del modelo |
| ¿Qué acción tomar? | Cada señal trae un **playbook**: responsable, canal, plazo, pasos y un borrador de WhatsApp listo para enviar |

Explícitamente **no** es un producto de predicción de churn. Quimun tiene 0% de
churn. El modelo predice *uso degradado*, que es lo que antecede al problema.

---

## Stack

- **Backend** — FastAPI + SQLAlchemy sobre SQLite. Analítica de solo lectura;
  ningún indicador de salud queda congelado en la base, así que cambiar una regla
  toma efecto de inmediato y sin backfill.
- **Frontend** — Next.js 15 (App Router) + TypeScript. Sin framework de UI y sin
  librería de gráficos: sistema de diseño escrito a mano y SVG propio.
- **Modelo** — scikit-learn solo en entrenamiento. Los pesos se exportan a
  `data/model.json` y se evalúan con ~40 líneas de Python puro en cada request,
  así el API desplegado no carga numpy/scipy/sklearn.
- **Idiomas** — español e inglés completos. Español por defecto, porque
  quimun.com, la empresa y sus clientes son chilenos.

---

## Cómo correrlo

Dos procesos. Primero el backend.

```bash
cd backend
pip install -r requirements.txt
python -m scripts.seed          # genera data/quimun.db  (~10s)
uvicorn app.main:app --reload   # http://127.0.0.1:8000
```

Para reentrenar el modelo — opcional, `data/model.json` ya viene entrenado:

```bash
pip install -r requirements-train.txt
python -m ml.train_model        # ~20s, imprime métricas fuera de muestra
```

Frontend:

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

Antes de una demo, correr el auto-chequeo — valida las invariantes que
realmente te dejarían mal frente a un cliente (números imposibles, señales sin
evidencia, placeholders sin renderizar en los mensajes, un modelo cuyas
predicciones colapsaron a un solo valor):

```bash
cd backend && python -m scripts.check    # 26 chequeos
```

`frontend/.env.local` apunta al API:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
API_BASE=http://127.0.0.1:8000
```

Si el API está caído, la UI lo dice y explica cómo levantarlo, en vez de
renderizar un dashboard vacío.

---

## Despliegue

Todo va en Vercel, como **dos proyectos del mismo repo** — Vercel permite que
cada proyecto elija su propio Root Directory.

| Proyecto | Root Directory | Qué es |
|---|---|---|
| `quimun-api` | `backend` | FastAPI como función serverless de Python |
| `quimun` | `frontend` | El dashboard Next.js |

Primero el API; después setear `NEXT_PUBLIC_API_URL` en el proyecto del frontend
con la URL del API, y `ALLOWED_ORIGINS` en el API con la URL del frontend.

**Sí, Vercel corre FastAPI** — tiene un preset propio. El preset busca un `app`
ASGI a nivel de módulo en una ubicación convencional, así que `backend/main.py`
reexporta la app real desde `app/main.py` y no hace falta configurar routing.

Dos cosas que te van a morder si te desvías: **no** dejes además un directorio
`api/` (Vercel pasa a tratar `/api/*` como carpeta de funciones y tapa las rutas
de FastAPI, devolviendo 404 en todos los endpoints), y no escribas `rewrites` a
mano: el preset ya los maneja. Las restricciones reales son el tamaño y el
sistema de archivos, y ambas están resueltas:

```
dependencias python  30,7 MB
data/quimun.db       20,9 MB
app/ + modelo         0,2 MB
────────────────────────────
TOTAL                51,7 MB     (límite de Vercel: 250 MB)
```

Ese margen no es casualidad. Si scikit-learn hubiera quedado como dependencia de
runtime habría costado **193 MB** (sklearn 47 + numpy 32 + scipy 114), dejando el
bundle en ~245 MB — bajo el límite, pero sin aire y con un cold start mucho más
lento. Exportar el modelo a 8 KB de JSON y evaluarlo en Python puro es lo que
hace que esto quepa cómodo.

La otra restricción es el filesystem de solo lectura. `app/core/config.py`
detecta el entorno serverless y copia el SQLite a `/tmp` en el cold start, así
que el triaje de señales sigue escribiendo. Esas escrituras son por instancia y
se pierden cuando la función se enfría — está bien para una demo, pero conviene
saberlo.

**¿Prefieres un contenedor?** `backend/Dockerfile` es una imagen
`python:3.12-slim` sin dependencias de ML, y `render.yaml` apunta al plan
gratuito de Render. Un contenedor siempre encendido evita cold starts, que es lo
único que consideraría para una demo en vivo sobre wifi de hotel.

```bash
docker build -t quimun-api ./backend
docker run -p 8000:8000 quimun-api
```

> **Qué verifiqué:** que el entrypoint ASGI importa y sirve, la cuenta de tamaño
> de arriba, y el camino del contenedor. No pude correr un `vercel deploy` real
> desde acá, así que los pasos de Vercel son correctos por construcción, no
> observados.

---

## Cómo funcionan los números

### Índice de uso (0–100)

Cuatro componentes, pesos fijos, cada uno mostrado junto al dato que lo produjo
— así "¿por qué esta cuenta está en 50?" siempre se responde en pantalla.

| Componente | Peso | Qué mide |
|---|---|---|
| **Intensidad** | 30% | Eventos por residente por semana, como percentil *dentro de su propio tramo de tamaño* |
| **Amplitud** | 25% | Proporción de módulos contratados realmente en uso, ponderada por importancia |
| **Cobertura de equipo** | 25% | Licencias y roles que efectivamente registran; penaliza que todo dependa de una persona |
| **Consistencia** | 20% | Ritmo — módulos diarios usados a diario, no en una puesta al día mensual |

Dos decisiones que vale la pena explicitar:

- **Todo se compara dentro del tramo de tamaño.** El brief dice que los clientes
  son muy distintos. Una residencia de 14 camas nunca se compara directamente
  con una de 130.
- **La tendencia queda fuera del índice** y se reporta al lado. Una residencia
  puede estar en 78 y ser la cuenta más urgente del libro si el mes pasado
  estaba en 92. El estado combina ambos en vez de aplicarles un OR, para que una
  cuenta modesta pero creciendo reciba un toque liviano y una cómoda pero cayendo
  reciba una intervención.

### Señales

Once reglas, cada una con su propia evidencia — ninguna se dispara sin un número
al lado. Entre ellas: caída sostenida, módulo abandonado, dependencia de un solo
usuario, brecha de registro clínico (la evidencia que revisa una fiscalización
SEREMI), portal de apoderados dormido, renovación en riesgo, fricción de soporte
y oportunidad de expansión.

El orden es severidad × ingreso en juego × probabilidad del modelo.

### El modelo — opcional por diseño

**El dashboard funciona sin él.** Si borras `data/model.json` todo sigue
andando: las 64 residencias, las 86 señales, el índice de uso completo. La
columna de riesgo muestra `—`, la caja de alerta temprana queda vacía y
`/modelo` avisa que falta el modelo. Nada más cambia.

Es a propósito. Las once señales son *reglas* con evidencia, y responden cuatro
de las cinco preguntas del brief por sí solas. El modelo aporta una sola cosa
que las reglas no pueden: una lectura hacia adelante sobre cuentas que hoy se
ven bien. Se queda si esa alerta temprana vale la pena; se saca si Raimundo
prefiere no tener un modelo en el medio.

Regresión logística que predice **uso degradado en 30 días** — intensidad por
debajo del 80% de la mediana de su propio tramo de tamaño.

Desempeño fuera de muestra sobre partición **temporal** (70/30 por fecha de
corte, nunca aleatoria — una partición aleatoria filtraría el futuro a través de
cortes vecinos de la misma residencia):

| | |
|---|---|
| AUC | **0,970** |
| Precisión promedio | 0,952 (tasa base 0,380) |
| Precisión / Cobertura | 0,887 / 0,849 |
| Brier | 0,073 |

Tres cosas del montaje importan más que el algoritmo:

1. **Las filas de entrenamiento las construye el código en vivo.**
   `build_features()` lo llaman tanto el entrenador como el API, así que el
   train/serve skew se elimina por construcción.
2. **Solo viajan los pesos.** sklearn es dependencia de desarrollo; producción
   evalúa un producto punto.
3. **Cada predicción se descompone exactamente.** El log-odds de un modelo
   logístico *es* una suma, así que las contribuciones por variable que muestra
   la UI son la aritmética misma, no una aproximación posterior.

La página `/modelo` muestra ROC, calibración, matriz de confusión y todos los
coeficientes, más una nota de honestidad explícita: el modelo está entrenado
sobre datos generados, así que las métricas miden qué tan bien recupera la
estructura que el generador introdujo. Lo que se traslada a producción es el
pipeline, no estos coeficientes.

---

## Los datos de demo

64 residencias, ~1.630 residentes, ~460 cuentas de personal y ~200k filas de uso
sobre 270 días, todo generado de forma determinista desde una semilla fija — los mismos números en
cada corrida y en cada ensayo.

No es ruido disfrazado de datos. Cada residencia recibe un arquetipo de
comportamiento con una trayectoria real, y los volúmenes diarios siguen cómo
opera un ELEAM de verdad:

- los módulos clínicos siguen tres turnos y **no paran los fines de semana** — el
  cuidado es 24/7, así que Ficha Clínica y Tratamientos apenas bajan un domingo;
- los módulos administrativos sí paran, los fines de semana y en los feriados
  chilenos;
- las Evaluaciones se concentran en los primeros días del mes, la Reportería en
  el cierre;
- la actividad se atribuye a personas con nombre cuyo rol efectivamente toca ese
  módulo, que es lo que hace detectable la dependencia de un solo usuario;
- cuando renuncia una enfermera jefe, se contrata reemplazo semanas después — y
  ese hueco de contratación es de donde sale la brecha de registro clínico.

La escala corresponde a lo que Quimun publica: el sitio dice **«+1.500 adultos
mayores gestionados en todo Chile»** y **«planes… desde 1 a 100+»**, así que el
libro queda en ~1.630 residentes en residencias de 8 a 101 camas, cargado hacia
lo pequeño porque la mayoría de los ELEAM chilenos son chicos.

Los nombres de módulos, las familias, la terminología (ELEAM, SENAMA, RUT,
apoderados, comunas), la estructura de tres módulos y la paleta de marca salen
de quimun.com, no están inventados.

---

## Nota sobre el color

El violeta de marca de Quimun (`#3919ba`, tomado de su sitio) es **solo cromo** —
navegación activa, botones primarios, focus ring, el logotipo. Nunca codifica
datos.

Las series de datos usan una paleta aparte, derivada del azul de Quimun y
validada para daltonismo en modo claro y oscuro (peor par CVD ΔE 8,9 claro /
10,5 oscuro; visión normal ΔE 21,2 / 20,3). Los colores de estado son fijos,
nunca cambian con el tema, y siempre van con etiqueta de texto — el tono nunca
carga el significado por sí solo.
