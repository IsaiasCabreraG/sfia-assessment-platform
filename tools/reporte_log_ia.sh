#!/usr/bin/env bash
# Genera el reporte (visor HTML, de solo lectura) del log de IA de desarrollo y, si se pide, lo abre en el navegador.
# El log lo escribe el módulo content cuando LOG_IA=1 en el .env (ver docs/architecture/code-guide.md, 4.6.2).
#
# Desde la raíz del proyecto:
#     bash tools/reporte_log_ia.sh                      # genera logs/ia/visor.html
#     bash tools/reporte_log_ia.sh --abrir              # además lo abre en el navegador de Windows
#     bash tools/reporte_log_ia.sh --carpeta otra/ruta  # usa otra carpeta con archivos .jsonl
set -eo pipefail
cd "$(dirname "$0")/.."

CARPETA="logs/ia"
ABRIR=0
while [ $# -gt 0 ]; do
    case "$1" in
        --abrir) ABRIR=1 ;;
        --carpeta) CARPETA="${2:?falta la carpeta después de --carpeta}"; shift ;;
        *) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
    esac
    shift
done

# Si no hay registros, ver_log_ia.py lo explica y termina con error.
bash tools/run_python.sh tools/ver_log_ia.py --carpeta "$CARPETA"
VISOR="$CARPETA/visor.html"

if [ "$ABRIR" = 1 ]; then
    if command -v wslview >/dev/null 2>&1; then
        wslview "$VISOR"
    elif command -v explorer.exe >/dev/null 2>&1; then
        explorer.exe "$(wslpath -w "$VISOR")" || true   # explorer.exe devuelve 1 aunque abra el archivo
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$VISOR"
    else
        echo "No encontré cómo abrir el navegador; abre a mano: $VISOR"
    fi
fi
