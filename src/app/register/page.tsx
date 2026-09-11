"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/lib/actions/ops";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("email", email);
    formData.set("password", password);

    const result = await registerAction(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      router.push("/login?success=account-created");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex items-center justify-center h-screen w-full overflow-hidden">
      <Image src="/login-background.jpg" alt="" fill priority className="object-cover" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(20,26,24,0.35) 0%, rgba(20,26,24,0.55) 100%)" }} />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 rounded-lg p-8 w-full max-w-sm mx-4"
        style={{ background: "rgba(255,255,255,0.96)", border: "1px solid var(--line)", backdropFilter: "blur(4px)" }}
      >
        <Image src="/logo.png" alt="Tropera" width={64} height={64} className="mb-3 w-16 h-16 object-contain" />
        <h1 className="text-xl heading-title mb-1" style={{ color: "var(--ink)" }}>Crear cuenta</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Usa tu correo @tropera.cl</p>

        <label className="text-xs" style={{ color: "var(--muted)" }}>Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full mb-4 mt-1 px-3 py-2 rounded-md text-sm"
          style={{ border: "1px solid var(--line)" }}
        />

        <label className="text-xs" style={{ color: "var(--muted)" }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full mb-4 mt-1 px-3 py-2 rounded-md text-sm"
          style={{ border: "1px solid var(--line)" }}
        />

        <label className="text-xs" style={{ color: "var(--muted)" }}>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full mb-4 mt-1 px-3 py-2 rounded-md text-sm"
          style={{ border: "1px solid var(--line)" }}
        />

        {error && <p className="text-xs mb-4" style={{ color: "var(--c-danger)" }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-md text-sm text-white disabled:opacity-60"
          style={{ background: "var(--c-forest)" }}
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p className="text-xs mt-4 text-center" style={{ color: "var(--muted)" }}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--c-copper)" }}>
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
