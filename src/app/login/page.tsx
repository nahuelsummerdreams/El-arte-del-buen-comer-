import Image from "next/image";
import { FormularioLogin } from "./formulario-login";

export default function PaginaLogin() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <Image
        src="/logo.jpg"
        alt="Logo de El Arte del Buen Comer"
        width={754}
        height={765}
        priority
        className="h-32 w-32 rounded-full object-cover shadow-2xl shadow-black/60"
      />
      <FormularioLogin />
    </main>
  );
}
