#!/bin/bash
set -e

echo "=== Configurando Servidor en Oracle Cloud para BuscadorSalas ==="

# 1. Abrir puertos en iptables de Ubuntu (Oracle Cloud específico)
echo "[1/5] Configurando iptables para permitir puerto 80 (HTTP) y 443 (HTTPS)..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT

# Instalar y guardar persistencia de iptables
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent netfilter-persistent nginx
sudo netfilter-persistent save

# 2. Copiar servicio systemd si existe
echo "[2/5] Configurando servicio systemd 'buscadorsalas'..."
if [ -f /home/ubuntu/BuscadorSalas/buscadorsalas.service ]; then
    sudo cp /home/ubuntu/BuscadorSalas/buscadorsalas.service /etc/systemd/system/buscadorsalas.service
    sudo systemctl daemon-reload
    sudo systemctl enable buscadorsalas
fi

# 3. Configurar Nginx Reverse Proxy
echo "[3/5] Configurando Nginx en el puerto 80 hacia 127.0.0.1:5000..."
if [ -f /home/ubuntu/BuscadorSalas/nginx_buscadorsalas.conf ]; then
    sudo cp /home/ubuntu/BuscadorSalas/nginx_buscadorsalas.conf /etc/nginx/sites-available/buscadorsalas
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -sf /etc/nginx/sites-available/buscadorsalas /etc/nginx/sites-enabled/buscadorsalas
    sudo nginx -t
    sudo systemctl restart nginx
    sudo systemctl enable nginx
fi

# 4. Actualizar dependencias de Python y reiniciar la app
echo "[4/5] Instalando dependencias y reiniciando servicio buscadorsalas..."
cd /home/ubuntu/BuscadorSalas
if [ -d venv ]; then
    source venv/bin/activate
    pip install -r requirements.txt
fi
sudo systemctl restart buscadorsalas

# 5. Estado final
echo "[5/5] Verificando servicios..."
echo "--- Estado de Nginx ---"
sudo systemctl is-active nginx
echo "--- Estado de BuscadorSalas (Gunicorn) ---"
sudo systemctl is-active buscadorsalas

echo ""
echo "=== ¡Listo! Tu página ya debería ser accesible públicamente en: http://144.22.33.41 ==="
