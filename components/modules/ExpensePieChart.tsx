'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e']

interface Props {
  data: Array<{ name: string; value: number }>
}

export default function ExpensePieChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 italic">
        Sin gastos por categoría este mes
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="rgb(15 23 42)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgb(15 23 42)',
            border: '1px solid rgb(51 65 85)',
            borderRadius: '8px',
          }}
          formatter={(value) => [`₡${Number(value ?? 0).toLocaleString('es-CR')}`, 'Gasto']}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
