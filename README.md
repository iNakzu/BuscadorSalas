# Portal Estudiantil UDP

V1 enfocada en consultas académicas y organización personal: salas libres, profesores, ramos, semestre, horario por sala, solemnes, horario personal, notas, agenda, malla, estudio y timer.

## Desarrollo local

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
flask --app flask_app run
```

La aplicación pública funciona sin Supabase. Para autenticación y sincronización completa las variables de `.env` y aplica la migración SQL.

La definición de producto, seguridad, Supabase y despliegue está en [docs/V1_PRODUCT_AND_ARCHITECTURE.md](docs/V1_PRODUCT_AND_ARCHITECTURE.md).
