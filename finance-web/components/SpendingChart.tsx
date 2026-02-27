'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// 8 distinct colors for spending categories.
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
]

interface Props {
  data: { category: string; total: number }[]
}

export default function SpendingChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.total, 0)

  return (
    <div className="space-y-2">
      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]} />
            <Legend
              iconSize={10}
              formatter={(value: string) => (
                <span className="text-xs text-gray-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-sm text-gray-500">
        Total spent this month:{' '}
        <span className="font-semibold text-gray-800">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </p>
    </div>
  )
}
