'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Panel de Control', icon: '◉' },
  { href: '/flujo-caja', label: 'Flujo de Caja', icon: '↕' },
  { href: '/presupuestos', label: 'Presupuestos', icon: '▦' },
  { href: '/deudas', label: 'Deudas', icon: '↓' },
  { href: '/patrimonio-neto', label: 'Patrimonio Neto', icon: '△' },
]

interface Props {
  children: React.ReactNode
  userEmail?: string
}

export default function AppShell({ children, userEmail }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r border-slate-800/80 bg-slate-900/40 flex flex-col sticky top-0 h-screen">
        <div className="p-5 border-b border-slate-800/50">
          <Link href="/">
            <span className="text-lg font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              ZENFINANCE
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-400 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <span className="w-5 text-center text-xs opacity-70">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/50">
          {userEmail && (
            <p className="text-[10px] text-slate-500 px-3 mb-2 truncate">{userEmail}</p>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800/50 hover:text-white transition-all"
          >
            <span className="w-5 text-center text-xs opacity-70">⏻</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-slate-950 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
