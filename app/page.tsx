export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2">
          BM Coach
        </h1>

        <p className="text-center text-gray-600 mb-10">
          Panel de administración
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          <a href="/alumnos" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition">
            <h2 className="text-2xl font-semibold">👥 Alumnos</h2>
            <p>Gestionar alumnos.</p>
          </a>

          <a href="/rutinas" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition">
            <h2 className="text-2xl font-semibold">🏋️ Rutinas</h2>
            <p>Crear rutinas.</p>
          </a>

          <a href="/clases" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition">
            <h2 className="text-2xl font-semibold">📅 Clases</h2>
            <p>Organizar horarios.</p>
          </a>

          <a href="/pagos" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition">
            <h2 className="text-2xl font-semibold">💳 Pagos</h2>
            <p>Control de cuotas.</p>
          </a>

          <a href="/evaluaciones" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition">
            <h2 className="text-2xl font-semibold">📈 Evaluaciones</h2>
            <p>Seguimiento físico.</p>
          </a>

          <a href="/configuracion" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition">
            <h2 className="text-2xl font-semibold">⚙️ Configuración</h2>
            <p>Ajustes del sistema.</p>
          </a>

        </div>
      </div>
    </main>
  );
}