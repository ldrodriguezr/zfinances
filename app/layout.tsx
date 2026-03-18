import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZenFinance - Cloud FinOps",
  description: "Optimización financiera de alto nivel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50 antialiased`}>
        <div className="flex min-h-screen">
          {/* Sidebar - El Centro de Mando */}
          <aside className="w-72 border-r border-slate-800 bg-slate-900/40 backdrop-blur-xl flex flex-col sticky top-0 h-screen">
            <div className="p-8 border-b border-slate-800/50">
              <span className="text-2xl font-black bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent tracking-tighter">
                ZENFINANCE
              </span>
              <p className="text-[10px] text-slate-500 font-bold mt-1 tracking-widest uppercase">Cloud FinOps Engine</p>
            </div>
            
            <nav className="flex-1 p-4 space-y-2 mt-4">
              <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Principal</div>
              <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-all text-slate-400 hover:text-white group">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-indigo-500 transition-colors" />
                Panel de Control
              </a>
              <a href="/flujo-caja" className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Flujo de Caja
              </a>

              <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-6">Estrategia</div>
              <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-all text-slate-400 hover:text-white group italic opacity-50">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                Snowball (Pronto)
              </a>
              <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-all text-slate-400 hover:text-white group italic opacity-50">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                Patrimonio Neto
              </a>
            </nav>

            <div className="p-6 border-t border-slate-800/50 bg-slate-900/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-[10px] font-bold">DR</div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Diego R.</p>
                  <p className="text-[10px] text-slate-500">Cloud Engineer</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Área de Trabajo */}
          <main className="flex-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}