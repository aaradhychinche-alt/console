import { memo } from 'react'
import { useFlashOnChange } from '../../hooks/useFlashOnChange'

interface FlashingValueProps {
  value: number | string | undefined
  className?: string
  flashDuration?: number
}

/**
 * Component that displays a value and flashes when it changes.
 * The flash is a brief highlight animation to draw attention to updates.
 */
export const FlashingValue = memo(function FlashingValue({
  value,
  className = '',
  flashDuration = 1500,
}: FlashingValueProps) {
  const isFlashing = useFlashOnChange(value, flashDuration)

  return (
    <span
      className={`${className} ${isFlashing ? 'animate-value-flash' : ''}`}
    >
      {value}
    </span>
  )
})
