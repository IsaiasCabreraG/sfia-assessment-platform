"""Asigna o quita roles (lista blanca de los portales) desde la línea de comandos.

Uso (desde la raíz del proyecto):
    bash tools/run_python.sh modules/identity/identity/grant_role.py correo@x.com teacher_recruiter validator
    bash tools/run_python.sh modules/identity/identity/grant_role.py --quitar correo@x.com validator

Si el correo aún no inició sesión, se crea un usuario provisional que se completa en su primer login.
"""
import argparse

from shared.db import connect

from identity import service


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("email")
    parser.add_argument("roles", nargs="+", help="teacher_recruiter, validator o admin")
    parser.add_argument("--quitar", action="store_true", help="quita los roles en vez de asignarlos")
    args = parser.parse_args()

    with connect() as conn, conn.cursor() as cur:
        for role in args.roles:
            if args.quitar:
                service.revoke_role(cur, args.email, role)
            else:
                service.grant_role(cur, args.email, role)
    print(("Quitados" if args.quitar else "Asignados"), "roles", args.roles, "a", args.email)


if __name__ == "__main__":
    main()
