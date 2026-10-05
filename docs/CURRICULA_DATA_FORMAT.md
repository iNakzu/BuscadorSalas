# Carreras y mallas curriculares

El catálogo de carreras está en `static/data/udp-careers.json`. Cada programa tiene un `id` estable, nombre visible, escuela (`EII`, `EOC`, `EIT` o `null`), duración conocida y el nombre de su archivo de malla. El Plan Común dura un año y no pertenece a una escuela. No se infiere la duración de los demás programas.

Cada archivo de malla vive en `app/data/curricula/` y usa este formato:

```json
{
  "version": 1,
  "careerId": "ingenieria-civil-industrial",
  "school": "EII",
  "semestres": {
    "1": {
      "nombre": "Semestre I",
      "ramos": [
        {"nombre": "Nombre oficial de la asignatura", "keywords": ["nombre usado en data.json"]}
      ]
    }
  }
}
```

`keywords` enlaza el nombre oficial de la malla con los nombres de cursos que entrega el horario universitario. Se agregan solo equivalencias respaldadas por la malla o por los datos oficiales; no se inventan asignaturas ni coincidencias. Los semestres y sus botones se generan a partir del archivo de cada carrera, así el Plan Común puede tener sus dos semestres.

La malla de Informática ya está convertida a este formato. Los archivos de Industrial, Obras Civiles, Ciencia de Datos y Plan Común están creados como plantillas vacías, de modo que la vista no muestre por error la malla de Informática. Al recibir el plan de estudios de cada carrera, se completa su archivo y queda disponible para las cuentas que tengan seleccionada esa carrera en Mi perfil. La vista personalizada de malla requiere una carrera guardada; los datos del perfil no se publican a la comunidad.
