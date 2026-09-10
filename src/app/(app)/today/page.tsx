export default function Page() {
  return (
    <div className="p-6">
      <div
        className="flex flex-col items-center justify-center text-center py-20 rounded-lg"
        style={{ border: "1px dashed var(--line)", color: "var(--muted)" }}
      >
        <div className="text-sm">Este módulo se migra en la siguiente fase.</div>
        <div className="text-xs mt-1">Ya está construido y validado en el prototipo — falta portarlo a datos reales.</div>
      </div>
    </div>
  );
}
