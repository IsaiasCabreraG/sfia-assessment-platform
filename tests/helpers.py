"""Ayudas de las pruebas de content: reproducen lo que hace el portal (borradores y luego publicar)."""


def borradores(client, user, skill_id, item_type="single_choice", count=1, level=3, minutes=10, context=None,
               **extra):
    """Primer paso del portal: pide borradores a la IA (no se guardan)."""
    return client.post("/drafts", headers=user["headers"], json={
        "skill_id": str(skill_id), "level": level, "item_type": item_type, "item_count": count,
        "estimated_minutes": minutes, "context": context, **extra})


def publicar(client, user, skill_id, item_type, items, level=3, minutes=10, context=None, disponible=True):
    """Segundo paso: guarda en el banco los ítems revisados (por defecto, disponibles para los validadores)."""
    return client.post("/items/publish", headers=user["headers"], json={
        "available_to_experts": disponible,
        "groups": [{"skill_id": str(skill_id), "level": level, "item_type": item_type,
                    "estimated_minutes": minutes, "context": context, "items": items}]})


def generar(client, user, skill_id, item_type="single_choice", count=1, level=3, minutes=10, context=None,
            disponible=True):
    """Borradores + publicación sin ediciones. Devuelve la respuesta de la publicación (201) o, si la IA o
    el pedido fallan, la respuesta del paso de borradores."""
    r = borradores(client, user, skill_id, item_type, count, level, minutes, context)
    if r.status_code != 200:
        return r
    return publicar(client, user, skill_id, item_type, r.json()["drafts"], level, minutes, context, disponible)
