import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT ?? 3004;

app.listen(PORT, () => {
  console.log(`📋 operaciones-service corriendo en http://localhost:${PORT}`);
  console.log(`   → http://localhost:${PORT}/api/v1/emilypamela/reservas`);
  console.log(`   → http://localhost:${PORT}/api/v1/emilypamela/alquileres`);
  console.log(`   → http://localhost:${PORT}/api/v1/emilypamela/devoluciones`);
  console.log(`   → http://localhost:${PORT}/api/v1/emilypamela/seguros`);
  console.log(`   → http://localhost:${PORT}/api/v1/emilypamela/tarifas`);
  console.log(`   → http://localhost:${PORT}/api/v1/emilypamela/canales-venta`);
});
