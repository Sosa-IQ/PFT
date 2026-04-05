'use client'

import { useState, useEffect } from 'react'
import { HexColorPicker } from 'react-colorful'
import { CATEGORY_PALETTE, isHexColor } from '@/lib/categories'

export default function ColorPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (key: string | null) => void
}) {
  const isCustom = isHexColor(value)
  const [hexInput, setHexInput] = useState<string>(isCustom ? value! : '#6366f1')

  useEffect(() => {
    if (isHexColor(value)) setHexInput(value)
  }, [value])

  function handleRainbowClick() {
    const valid = /^#[0-9a-fA-F]{6}$/.test(hexInput)
    const hex = valid ? hexInput : '#6366f1'
    setHexInput(hex)
    onChange(hex)
  }

  function handlePickerChange(hex: string) {
    setHexInput(hex)
    onChange(hex)
  }

  function handleHexChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value
    if (raw && !raw.startsWith('#')) raw = '#' + raw
    setHexInput(raw)
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw)
  }

  const hexValid = /^#[0-9a-fA-F]{6}$/.test(hexInput)

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* None / auto */}
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Auto (keyword-based)"
          className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 bg-surface-raised ${
            value === null ? 'border-cream scale-110' : 'border-surface-border'
          }`}
        />

        {/* Preset palette */}
        {Object.entries(CATEGORY_PALETTE).map(([key, entry]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={entry.label}
            className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
              value === key ? 'border-cream scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: entry.swatch }}
          />
        ))}

        {/* Rainbow — always the color wheel; ring shows custom mode is active */}
        <button
          type="button"
          onClick={handleRainbowClick}
          title="Custom color"
          className={`relative h-6 w-6 overflow-hidden rounded-full border-2 transition-transform hover:scale-110 ${
            isCustom ? 'border-cream scale-110' : 'border-transparent'
          }`}
        >
          <span
            className="absolute inset-0"
            style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
          />
        </button>
      </div>

      {/* Visual picker + hex input — only shown in custom mode */}
      {isCustom && (
        <div className="space-y-2 overflow-hidden rounded-xl border border-surface-border">
          <HexColorPicker
            color={hexValid ? hexInput : '#6366f1'}
            onChange={handlePickerChange}
            style={{ width: '100%', borderRadius: 0 }}
          />
          <div className="flex items-center gap-2 px-3 pb-3">
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-surface-border"
              style={{ backgroundColor: hexValid ? hexInput : undefined }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={handleHexChange}
              maxLength={7}
              placeholder="#000000"
              spellCheck={false}
              className="flex-1 rounded-lg border border-surface-border bg-surface-raised px-2 py-1 font-mono text-sm text-cream placeholder:text-cream-muted/50 focus:border-accent focus:outline-none"
            />
            {!hexValid && (
              <span className="shrink-0 text-xs text-danger">invalid</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
