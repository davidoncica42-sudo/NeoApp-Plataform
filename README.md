# NeoApp-Plataform

Sitio de NeoApp: universo espacial, información, recompensas globales, tienda en euros y perfil de usuario.

## Cuentas y estrellas

Al abrir la web se pide crear una cuenta o iniciar sesión. La sesión se mantiene en este dispositivo; el saldo y el historial viven en la base de datos. Cada cuenta puede reclamar **150 estrellas una vez al día**. Los reclamos y canjes se validan en PostgreSQL para evitar saldos editados desde el navegador.

La conexión usa Supabase Auth y PostgREST. Para activarla, sigue [CONFIGURAR-CUENTAS.md](CONFIGURAR-CUENTAS.md): aplica la migración SQL y configura la URL y la Publishable key del proyecto en `config.js`. Hasta completar ese paso, la web muestra el acceso pero no crea cuentas.

La cesta y el pago en euros siguen siendo una demostración. No se cobra ni se crea un pedido.

## Abrir localmente

Esta web no necesita instalar dependencias. Sirve la carpeta desde un terminal:

```bash
python -m http.server 4173
```

Luego abre `http://localhost:4173`.

## Publicar en GitHub Pages

En **Settings → Pages**, selecciona **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`. Configura `config.js` con la URL del proyecto Supabase y su Publishable key antes de publicar.

