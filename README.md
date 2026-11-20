# NeoApp

Una primera versión interactiva de la plataforma NeoApp, con estética espacial oscura y diseño adaptable a móvil.

## Incluye

- Inicio con identidad visual, navegación y accesos a las secciones principales.
- Información sobre NeoApp.
- Catálogo de recompensas globales con búsqueda, filtros y canje de estrellas de muestra.
- Tienda en euros con artículos digitales y cesta de muestra.
- Perfil de NeoApp con saldo e historial de canjes de demostración.
- Diseño responsive, navegación por teclado y respeto a la preferencia de movimiento reducido.

## Abrir la web

Es una web estática, sin pasos de instalación ni dependencias. Puedes abrir `index.html` directamente o servir la carpeta desde un terminal:

```bash
python -m http.server 4173
```

Después abre `http://localhost:4173` en el navegador.

## Estado de las integraciones

La cesta, los canjes y la cuenta son demostraciones de interfaz. El saldo y el historial de canjes se guardan en el almacenamiento local del navegador. No hay usuarios reales, servidor, autenticación, pedidos ni pagos conectados, y no se realiza ningún cobro.

Para convertirla en una plataforma real habrá que conectar una API para usuarios y recompensas, almacenar los saldos de forma segura en el servidor y añadir un proveedor de pagos con validación del lado del servidor.

## Publicar en GitHub Pages

En el repositorio, abre **Settings → Pages**, selecciona **Deploy from a branch**, elige `main` y la carpeta `/ (root)`, y guarda. La web está preparada para servirse desde la raíz del repositorio.

