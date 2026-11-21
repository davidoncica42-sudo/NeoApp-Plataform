# Activar cuentas de NeoApp

La web estática de GitHub Pages no puede guardar contraseñas ni saldos por sí sola. La integración usa Supabase Auth y una base de datos PostgreSQL; la web solo recibe la URL y la clave pública `anon` del proyecto.

## Preparar el proyecto

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta `supabase/migrations/20261121_neoapp_accounts_and_points.sql`.
3. En **Authentication → URL Configuration**, añade como URL permitida la dirección publicada de NeoApp-Plataform.
4. Copia **Project URL** y la **Publishable key** en `config.js` (`supabaseUrl` y `supabasePublishableKey`).
5. Publica los cambios de `config.js` en GitHub Pages.

La Publishable key está pensada para el navegador y no da privilegios de servidor. Nunca pongas una clave `secret` o `service_role` en `config.js`. La función de reclamo suma 150 estrellas una vez por día UTC dentro de la base de datos; las recompensas también se descuentan allí y el historial se lee por usuario.

Al crear una cuenta, Supabase puede pedir confirmación por correo según la configuración de Auth del proyecto. En ese caso, el usuario podrá iniciar sesión después de confirmar el correo.

