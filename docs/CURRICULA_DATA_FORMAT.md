# Carreras y mallas curriculares

El catálogo de carreras está en `static/data/udp-careers.json`. Cada archivo de `app/data/curricula/` es la única fuente de cursos por semestre para las vistas **Malla** y **Horarios por semestre**. La versión 2 guarda cada ramo una sola vez en `semestres`; no se mantiene una lista paralela `mallaVisual`.

```json
{
  "version": 2,
  "careerId": "ingenieria-civil-industrial",
  "school": "EII",
  "semestres": {
    "1": {
      "nombre": "Semestre I",
      "ramos": [
        {
          "id": "1",
          "nombre": "Álgebra y Geometría",
          "keywords": ["algebra y geometria"],
          "requisitos": [],
          "codigo": "CBM-1000",
          "color": "124, 238, 238"
        }
      ]
    }
  }
}
```

`id`, `nombre`, `keywords` y `requisitos` son datos comunes. Los requisitos se refieren a los `id` de otros ramos de la misma carrera. `codigo`, `creditos`, `idVisible`, `color` y `border` son opcionales y se usan cuando la fuente de la malla los incluye. Los campos visuales se conservan junto al curso, no en una segunda lista.

`keywords` contiene nombres completos con los que el horario oficial identifica ese ramo. La búsqueda normaliza mayúsculas, tildes, puntuación y espacios, y compara nombres completos; no usa fragmentos que puedan confundir, por ejemplo, «Mecánica» con «Mecánica de Fluidos». Solo se agregan equivalencias respaldadas por el nombre oficial o por una fuente de la carrera. Si no hay equivalencia segura, se conserva el ramo en su semestre y no se le atribuyen clases.

La API de horarios consume los `nombre` y `keywords` del catálogo. La API de malla visual transforma los mismos `ramos` a la respuesta gráfica existente, incluyendo códigos, requisitos y colores. Así, cambiar el semestre o el nombre de un ramo requiere actualizar una sola entrada.

Las mallas visuales cargadas actualmente son Informática y Telecomunicaciones, Industrial, Obras Civiles y Plan Común. Ciencia de Datos e Inteligencia Artificial permanece sin semestres hasta incorporar su fuente. Plan Común tiene dos semestres; sus códigos, requisitos y créditos se omiten si no aparecen en la fuente.
