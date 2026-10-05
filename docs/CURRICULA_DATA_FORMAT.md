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

Los archivos también pueden incluir `mallaVisual`, que alimenta la vista personal **Malla**. Cada curso tiene un identificador estable, nombre, requisitos como identificadores de curso y, cuando la fuente lo muestra, su código. `idVisible: false` permite usar un identificador interno sin mostrar una numeración que no existe en la fuente. `color` y `border` son valores RGB separados por comas. Los créditos solo se guardan cuando la fuente realmente entrega créditos; no se deben copiar números de otras posiciones de la cápsula.

```json
{
  "mallaVisual": {
    "semestres": [
      {"numero": 1, "cursos": [
        {"id": "1", "codigo": "CBM-1000", "nombre": "Álgebra y Geometría", "requisitos": [], "color": "152, 206, 255"}
      ]}
    ]
  }
}
```

`keywords` enlaza el nombre oficial de la malla con los nombres de cursos que entrega el horario universitario. Se agregan solo equivalencias respaldadas por la malla o por los datos oficiales; no se inventan asignaturas ni coincidencias. Los semestres y sus botones se generan a partir del archivo de cada carrera, así el Plan Común puede tener sus dos semestres.

La búsqueda **Ramos por Semestre** usa `semestres`; la vista personal **Malla** usa `mallaVisual`. No se debe asumir que una de las dos implica que la otra esté completa. Informática conserva sus cursos y créditos originales; Obras Civiles e Industrial usan sus códigos, numeración y requisitos transcritos de sus imágenes. Plan Común tiene dos semestres y su fuente no muestra códigos, numeraciones por curso, requisitos ni créditos, así que esos datos se omiten. Las mallas visuales se sirven por `/api/malla/progreso/<career_id>` y requieren una carrera guardada en el perfil.
