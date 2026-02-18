# PayOnProof (POP)

## Dev setup (front + back)

This repo now has two services:
- `services/web` (Next.js frontend)
- `services/api` (Vercel serverless REST API)

Local run (two terminals):
1. `cd services/web` then `npm install` and `npm run dev`
2. `cd services/api` then `npm install` and `npm run dev`

Env files:
- `services/web/.env.example` -> `.env.local`
- `services/api/.env.example` -> `.env`

Vercel deploy:
- Create two separate Vercel projects, one per service.
- `services/web` uses `NEXT_PUBLIC_API_BASE_URL` pointing to the API project URL.

POP es una interfaz simple (KISS) que agrega múltiples Anchors de Stellar y enruta pagos transfronterizos por la mejor tasa disponible en tiempo real.

No es un banco.  
No es un marketplace.  
Es la capa que optimiza cómo las PYMEs pagan internacionalmente.

---

## 🌍 El problema

Las PYMEs y freelancers en LATAM pierden entre **3% y 8% por pago internacional** debido a:

- Spreads cambiarios ocultos  
- Fees acumulados por corresponsales  
- Tiempos impredecibles (3–5 días hábiles)  
- Falta de transparencia sobre el costo real  

Aunque existen Anchors en Stellar con mejores condiciones, integrarlos individualmente es técnicamente complejo para una PYME promedio.

Resultado:
- Márgenes erosionados  
- Menor competitividad  
- Fricción operativa constante  

---

## 💡 La solución

POP agrega múltiples Anchors de Stellar en una sola interfaz y:

- Consulta tasas en tiempo real  
- Normaliza fees y condiciones  
- Permite elegir manualmente o usar “Escoge por mí”  
- Ejecuta el pago por la ruta más económica  
- Registra un evento verificable on-chain  

El usuario solo ve:

Monto enviado → Monto recibido → Fee total → Tiempo estimado

Sin wallets complejas.  
Sin integraciones técnicas.  
Sin opacidad.

---

## 🧠 Cómo funciona

1. El usuario ingresa:
   - Monto
   - Moneda origen
   - Moneda destino
   - País origen/destino

2. POP consulta múltiples Anchors vía SEP-24 / SEP-31.

3. El sistema:
   - Calcula la mejor ruta
   - Muestra resumen transparente
   - Permite ejecución manual o automática

4. Se ejecuta el pago sobre Stellar.

5. Se registra un evento verificable con:
   - Hash de transacción
   - Anchor utilizado
   - Timestamp
   - Monto final liquidado

---

## 🏗 Arquitectura (alto nivel)

### Componentes

- Frontend (UI KISS)
- API Orquestadora
- Módulo de Enrutamiento
- Integración con Anchors
- Capa Blockchain (Stellar)
- Indexador Off-chain

---

## 🔐 On-chain vs Off-chain

### On-chain (Stellar)

- Hash de transacción
- Anchor utilizado
- Timestamp
- Monto final liquidado
- ID verificable del evento

### Off-chain

- Simulaciones previas
- Datos personales
- Configuración del usuario
- Analítica de ahorro

POP no custodia fondos a largo plazo.

---

## 📊 Beneficios medibles

- Reducción de 3%–8% por pago vs banca tradicional
- Liquidación en minutos en lugar de días
- Transparencia total antes de confirmar
- Historial verificable
- Ahorro acumulado visible

---

## 🎯 MVP (Impacta Bootcamp)

La demo prueba:

- Agregación multi-Anchor
- Enrutamiento automático
- Ejecución real sobre Stellar
- Registro verificable del resultado

Caso mostrado:

PYME paga a proveedor internacional →  
POP consulta Anchors →  
Selecciona mejor tasa →  
Ejecuta pago →  
Muestra confirmación verificable.

---

## ⚙️ Estándares utilizados

- Stellar SEP-24
- Stellar SEP-31
- Assets sobre Stellar (ej. USDC)
- APIs REST para integraciones B2B

---

## 🚨 Riesgos y mitigaciones

Indisponibilidad de Anchors  
→ Fallback automático multi-Anchor

Errores de normalización  
→ Validaciones y sanity checks

Riesgo regulatorio  
→ POP no custodia fondos  
→ KYC/AML recae en Anchors

---

## 📈 Métricas objetivo

- ≥ 3–8% ahorro promedio por pago
- Liquidación en minutos
- >99% éxito sin reprocesos





.
