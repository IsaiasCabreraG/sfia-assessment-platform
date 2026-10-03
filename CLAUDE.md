# Comportamiento esperado de Claude en este proyecto

- Responde siempre en español, de forma concisa y técnica.

## Cambios a archivos: siempre con aprobación

- No modifiques, crees, muevas ni borres ningún archivo del proyecto sin aprobación explícita del usuario.
- Antes de cambiar, muestra para cada archivo: ruta y líneas, **Antes** (texto actual textual),
  **Después** (texto nuevo) y el motivo. Si el archivo es nuevo, muestra su contenido completo.
- La aprobación vale solo para los cambios mostrados. Si el usuario modifica uno, aplica su versión.
- Los archivos generados, como el PNG de una figura, se regeneran solo después de aprobar el cambio a su fuente.
- Excepción: los archivos temporales de trabajo (scripts auxiliares, borradores, vistas previas,
  salidas intermedias) van en `scratchpad/` en la raíz del proyecto y no requieren aprobación.
  Todo lo que se escriba fuera de `scratchpad/` sí la requiere. No muevas ni copies nada de
  `scratchpad/` al proyecto sin aprobación.

## Decisiones y alcance

- No tomes decisiones de alcance o diseño que no estén en los documentos: pregunta.
- Si un cambio afecta a varios archivos, busca las demás menciones y avísalas aunque se trabajen por separado.
- No agregues contenido que el usuario no pidió.

## Figuras

- Cada figura tiene tres archivos en `docs/architecture/figures/` con el mismo prefijo `fig-NN-nombre`:
  `.md` (descripción), `.html` (fuente) y `.png` (render).
