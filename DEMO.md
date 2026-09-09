# Guion de demo · Quimun

**Duración: 12 minutos.** Los datos son deterministas: los mismos números en
cada ensayo y en la reunión. Idioma por defecto español; el botón `EN` del
sidebar cambia todo a inglés en vivo.

> English version at the bottom → [English walkthrough](#english-walkthrough)

**Antes de empezar:** levantar los dos procesos y dejar el navegador en
`http://localhost:3000` con el tema en `AUTO`.

---

## 0 · El encuadre (30 s)

> "Raimundo, esto no es un producto de churn. Tú tienes 0% de churn — predecir
> algo que no ha pasado nunca no te sirve. Esto responde otra pregunta: **de las
> 64 residencias, ¿a cuál le escribo hoy y qué le digo?**"

---

## 1 · Portafolio (2 min)

Abrir `/`.

Señalar la fila de KPIs:

- **64 residencias · 2.685 residentes** — todo el libro en una pantalla.
- **Índice de uso medio 80,7** — sano, pero no uniforme.
- **9 requieren atención, +13 en observación.**
- **$3,6M de MRR en cuentas en riesgo**, sobre $24,8M totales.

> "Hoy esto vive en tu cabeza y en 64 chats de WhatsApp. Acá está en una fila."

**Gráfico de actividad**: la curva baja en invierno y se recupera. Es
estacionalidad real (fin de año y Fiestas Patrias), no un problema.

> "Fíjate que el eje no parte en cero. Es una línea de tendencia, no una barra —
> si partiera en cero, esta caída de 10% se vería plana y no te enterarías."

**Distribución por estado**: 42 saludable / 13 observación / 6 en riesgo / 3 crítico.

**Alerta temprana del modelo** (columna derecha) — dejarlo para el final del
recorrido, pero mencionarlo:

> "Esas cuatro se ven bien hoy. El modelo dice que en 30 días no lo van a estar.
> Volvemos a eso."

---

## 2 · Señales — el corazón (4 min)

Click en **Señales**. 86 señales abiertas, ordenadas por prioridad.

> "La prioridad no es solo severidad. Es severidad × ingreso en juego ×
> probabilidad del modelo. Una residencia de 12 camas y una de 130 con el mismo
> síntoma no pueden ordenarse igual."

Seleccionar la primera: **Casa de Reposo Santa Clara · Brecha en registro clínico**.

Leer el detalle en voz alta:

> *"15 días sin registro en módulos clínicos durante los últimos 28. Es la
> evidencia que revisa una fiscalización SEREMI."*

> "Esto no es un score. Es un hecho con número, y es el hecho que le importa a
> la directora — no que su 'health score' bajó 12 puntos."

Bajar al **borrador de mensaje**:

> *"Hola Fernanda, te escribo por algo que conviene mirar: en el último mes
> quedaron 15 días sin registro clínico en Casa de Reposo Santa Clara. Ante una
> fiscalización eso se nota. ¿Vemos qué está pasando con los turnos? Podemos
> dejarlo ordenado esta semana."*

**Este es el momento de la demo.** Decirlo explícitamente:

> "Ese mensaje sale con el nombre de la persona, el número real y el tono con el
> que tú ya les escribes. Botón **Abrir WhatsApp** y se va. No te estoy pidiendo
> que cambies tu proceso — te lo estoy industrializando."

Mostrar **Triaje** (Abierta / En curso / Resuelta / Descartada) — persiste.

Cambiar el filtro de severidad y de tipo para mostrar los 11 tipos de señal.

---

## 3 · Ficha de una residencia (3 min)

Desde la señal, **Ver ficha** → `Residencia El Espino`.

- **Índice 50,4 · Crítico · −39,6%** en 28 días.
- **Percentil 4 en su tramo** — mediana del tramo 33,7 vs. sus 1,5.

> "El percentil es contra residencias de su mismo tamaño, nunca contra todas.
> Comparar una de 29 residentes con una de 130 no dice nada, y tú me dijiste que
> tus clientes son muy distintos entre sí."

**Índice de uso** — los cuatro componentes con el dato que los produjo:

- Intensidad 14,4 → *1,5 eventos/residente/semana, percentil 4 entre 23 pares*
- Amplitud 66,7 → *3 de 5 módulos contratados en uso*
- Cobertura 65,0 → *3 de 6 licencias activas, 44% concentrado en Carmen*
- Consistencia 65,7 → *25 de 28 días con actividad, 18 días sin registro clínico*

> "Ninguno de estos números es una caja negra. Si me preguntas por qué está en
> 50, la respuesta está en la misma pantalla."

**Actividad por familia**: la curva de Salud cae de ~85 a ~10.

> "A la derecha, cada familia en su propia escala. El registro clínico es 70
> veces el volumen administrativo — en una escala compartida, Hotelería y
> Administración quedarían pegadas al eje y no verías que también cayeron."

**Riesgo proyectado 99%** con las contribuciones por variable.

> "Las barras suman exactamente el log-odds. Rojo empuja el riesgo, azul lo
> contiene. No es una explicación aproximada del modelo: es la aritmética."

---

## 4 · Módulos (1,5 min)

Click en **Módulos**.

- Salud 333K vs. Hotelería 4,9K vs. Administración 4,9K.
- **Portal de Apoderados: 54% de adopción, 19 residencias nunca lo usaron.**

> "Ese es un módulo que ya vendiste y que nadie está usando. Es lo que más ven
> las familias del residente. Ahí hay una conversación de upsell y una de
> retención al mismo tiempo."

**Matriz de adopción**: 64 × 10. Gris = contratado sin uso. Vacío = no contratado.

---

## 5 · Modelo (1,5 min)

Click en **Modelo**. Esta página existe para que la puedan auditar.

- **AUC 0,972 · Precisión 86,7% · Cobertura 89,3%**
- Partición **temporal**, no aleatoria.

> "La partición es por fecha. Si fuera aleatoria, el futuro se filtraría al
> entrenamiento a través de cortes vecinos de la misma residencia y este AUC
> sería ficción."

- Matriz de confusión con la lectura en castellano: *"De cada 100 residencias
  que el modelo marca, 87 efectivamente se degradan."*
- **Nota de honestidad** — leerla en voz alta. No esconderla.

> "Está entrenado sobre datos generados. Lo que se traslada a producción es el
> pipeline, no estos coeficientes. Con tus datos reales se reentrena y los
> números cambian."

---

## 6 · Cierre (1 min)

Volver a `/` y apuntar a **Alerta temprana**:

> "Casa de Reposo Los Tilos: índice 75, tendencia +1%. Se ve bien. El modelo le
> da 96% de uso degradado en 30 días, porque su intensidad está muy abajo del
> percentil de su tramo y los últimos 7 días vienen bajo su propio promedio.
> Esa es la conversación que hoy no estás teniendo."

Cambiar a **EN** en el sidebar.

> "Todo bilingüe, por si algún día el equipo o un inversionista lo necesita en
> inglés."

Cerrar con el cuello de botella, que es lo que te pidió:

> "El stack es FastAPI y Next.js sobre tu propia data de uso. No reemplaza
> Pipedrive ni tu plataforma: lee los eventos que ya estás guardando. Lo que
> sigue es media hora contigo para ver qué tablas exponemos y en qué formato."

---

## Objeciones probables

| Te dicen | Respondes |
|---|---|
| "¿Esto es otro health score?" | "El índice es una entrada, no el producto. El producto es la señal con la acción y el mensaje listo. Y el índice se abre en cuatro números que puedes discutir uno por uno." |
| "Mis residencias son muy distintas entre sí." | "Por eso toda comparación es dentro del tramo de tamaño. Micro, pequeña, mediana y grande, cada una con su propia mediana." |
| "¿De dónde salen estos datos?" | "Generados, y está dicho en la página del modelo. Los módulos, la terminología y la estructura salen de quimun.com. Lo que conectamos después es tu stream real." |
| "¿Cuánto demora integrarlo?" | "El modelo de datos que necesita son eventos con residencia, usuario, módulo y fecha. Si eso ya existe en tu plataforma, es un ETL, no un rediseño." |
| "¿Y si el modelo se equivoca?" | "Las 11 señales son reglas, no modelo — cada una con su número. El modelo es una capa aparte y aditiva. Si mañana lo apagas, el dashboard sigue funcionando entero." |

---

# English walkthrough

Same route, 12 minutes. Toggle `EN` in the sidebar first.

1. **Framing (30 s)** — "This isn't churn prediction. You have 0% churn.
   It answers: *which of the 64 residences do I message today, and what do I say?*"
2. **Portfolio (2 min)** — 64 residences, average index 80.7, 9 needing
   attention, $3.6M MRR at risk of $24.8M. The activity line uses a fitted
   baseline, not zero, so a 10% seasonal dip is visible rather than flat.
3. **Signals (4 min)** — 86 open, ranked by severity × revenue × model
   probability. Open *Santa Clara · clinical recording gap*: "15 days with no
   clinical recording in the last 28 — the evidence a SEREMI inspection
   reviews." Then the WhatsApp draft. **This is the moment**: it carries the real
   name, the real number, and the tone he already uses. One button and it's sent.
4. **Residence detail (3 min)** — El Espino, index 50.4, −39.6%, 4th percentile
   *within its size band*. Four index components each shown next to the figure
   that produced it. Family small multiples on independent scales, because
   clinical volume is ~70× administrative.
5. **Modules (1.5 min)** — Family Portal at 54% adoption, 19 residences never
   used it. Sold, unused, and the most visible module to residents' families.
6. **Model (1.5 min)** — AUC 0.972, temporal split, confusion matrix in plain
   language, and the honesty note read out loud, not hidden.
7. **Close (1 min)** — Early warning: Los Tilos looks fine at index 75 and +1%,
   and the model gives it 96%. "That's the conversation you're not having today."
   Then the bottleneck: FastAPI + Next.js reading events they already store.
