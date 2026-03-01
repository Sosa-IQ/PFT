'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

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

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  data: { category: string; total: number }[]
  selectedCategory?: string | null
  onCategoryClick?: (category: string) => void
}

function LegendColumn({
  items,
  selectedCategory,
  onCategoryClick,
}: {
  items: { category: string; total: number; color: string }[]
  selectedCategory?: string | null
  onCategoryClick?: (category: string) => void
}) {
  return (
    <div className="flex flex-col justify-center gap-2 min-w-0">
      {items.map((item) => {
        const dimmed = selectedCategory && selectedCategory !== item.category
        return (
          <div
            key={item.category}
            className={`flex items-center gap-2 min-w-0 cursor-pointer rounded-md px-1 py-0.5 transition-opacity ${dimmed ? 'opacity-40' : 'opacity-100'}`}
            onClick={() => onCategoryClick?.(item.category)}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <p className="text-xs text-gray-600 truncate">{item.category}</p>
              <p className="text-xs font-semibold text-gray-800">${fmt(item.total)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function SpendingChart({ data, selectedCategory, onCategoryClick }: Props) {
  const total = data.reduce((sum, d) => sum + d.total, 0)

  const itemsWithColor = data.map((d, i) => ({
    ...d,
    color: COLORS[i % COLORS.length],
  }))

  const mid = Math.ceil(itemsWithColor.length / 2)
  const leftItems = itemsWithColor.slice(0, mid)
  const rightItems = itemsWithColor.slice(mid)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <LegendColumn items={leftItems} selectedCategory={selectedCategory} onCategoryClick={onCategoryClick} />
        <div className="flex-1 h-56 min-w-0">
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
                onClick={(_, index) => onCategoryClick?.(data[index].category)}
                className="cursor-pointer"
              >
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    opacity={selectedCategory && selectedCategory !== d.category ? 0.3 : 1}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {rightItems.length > 0 && (
          <LegendColumn items={rightItems} selectedCategory={selectedCategory} onCategoryClick={onCategoryClick} />
        )}
      </div>
      <p className="text-center text-sm text-gray-500">
        Total spent this month:{' '}
        <span className="font-semibold text-gray-800">${fmt(total)}</span>
      </p>
    </div>
  )
}
