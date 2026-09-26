# Radar de Taquilla

Panel web para seguir la venta de entradas de Entradium: previsión frente al aforo, ingresos, curva de venta comparada con fiestas pasadas y plan de redes. Se entra con usuario y contraseña.

## Cómo está hecho

- `public/index.html`: la web entera (HTML, CSS y JS sin compilar).
- `api/login.js`, `api/logout.js`, `api/me.js`: inicio de sesión con cookie firmada. Bloquea durante 15 minutos tras 10 intentos fallidos.
- `api/events.js`: guarda y lee las fiestas en Upstash Redis.
- `api/advice.js`: el botón "Pedir plan a Claude" (opcional).
- `lib/`: código compartido (sesión y conexión a la base de datos).

Todo corre en Vercel con el plan gratuito. La base de datos es Upstash Redis, que Vercel conecta con un clic y también es gratis.

## Puesta en marcha (una vez)

1. En https://vercel.com, **Add New → Project** e importa el repositorio `sales-manager`. Framework Preset: **Other**. Dale a **Deploy**.
2. En el proyecto, **Storage → Create Database → Upstash (Redis) → plan Free**, y conéctala al proyecto. Vercel añade las variables de la base de datos solo.
3. En **Settings → Environment Variables** añade:
   - `APP_USERS`: los usuarios y contraseñas, así: `manu:tucontraseña,socio:otracontraseña`. Usa contraseñas largas y sin comas ni dos puntos.
   - `ANTHROPIC_API_KEY` (opcional): tu clave de https://console.anthropic.com para el botón de Claude. Sin ella el botón no aparece y el resto funciona igual.
4. **Deployments → ⋯ → Redeploy** para que coja las variables.

Tu web quedará en `https://<nombre>.vercel.app`. Cada cambio que se suba a la rama principal se publica solo.

## Usuarios

- Para añadir, quitar o cambiar contraseñas, edita `APP_USERS` en Vercel y vuelve a publicar (Redeploy).
- Al cambiar `APP_USERS` se cierran todas las sesiones abiertas.
- Todos los usuarios ven y editan las mismas fiestas.

## Seguridad

- Las contraseñas solo están en las variables de entorno de Vercel, que se guardan cifradas. No van en el código.
- La sesión es una cookie `HttpOnly` y `Secure` firmada, válida 30 días.
- La clave de Anthropic solo se usa desde el servidor y solo con una sesión válida.
