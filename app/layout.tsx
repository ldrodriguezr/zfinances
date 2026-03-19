import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZenFinance - FinOps Engine",
  description: "Optimización financiera de alto nivel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50 antialiased`}>
        <div className="flex min-h-screen">
          <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col sticky top-0 h-screen">
            <div className="p-6 border-b border-slate-800/50">
              <span className="text-xl font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                ZENFINANCE
              </span>
              <p className="text-[10px] text-slate-500 font-medium mt-1 tracking-widest uppercase">FinOps Engine</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              <Link
                href="/"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/60 text-slate-300 hover:text-white transition-colors"
              >
                Panel de Control
              </Link>
              <Link
                href="/flujo-caja"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/60 text-slate-300 hover:text-white transition-colors"
              >
                Flujo de Caja
              </Link>
            </nav>
          </aside>

          <main className="flex-1 bg-slate-950 min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
