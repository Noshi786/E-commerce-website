import { useEffect, useRef, useState } from 'react'

function StyledSelect({
  'aria-label': ariaLabel,
  className = '',
  disabled = false,
  onChange,
  options,
  placeholder,
  required = false,
  value,
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedOption = options[selectedIndex]

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  useEffect(() => {
    if (open && activeIndex >= 0) optionRefs.current[activeIndex]?.focus()
  }, [activeIndex, open])

  const close = () => {
    setOpen(false)
    setActiveIndex(-1)
    triggerRef.current?.focus()
  }

  const choose = (option) => {
    onChange(option.value)
    close()
  }

  const handleTriggerKeyDown = (event) => {
    if (disabled || !options.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const firstIndex = selectedIndex >= 0 ? selectedIndex : 0
      const nextIndex = event.key === 'ArrowDown'
        ? open ? (activeIndex + 1) % options.length : firstIndex
        : open ? (activeIndex - 1 + options.length) % options.length : Math.max(firstIndex - 1, 0)
      setActiveIndex(nextIndex)
      setOpen(true)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
      setOpen((current) => !current)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      close()
    } else if (event.key === 'Home' && open) {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End' && open) {
      event.preventDefault()
      setActiveIndex(options.length - 1)
    }
  }

  const handleOptionKeyDown = (event, index) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index + direction + options.length) % options.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className={`styled-select ${className}`} ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-required={required || undefined}
        className="styled-select-trigger"
        disabled={disabled}
        onClick={() => {
          setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
          setOpen((current) => !current)
        }}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span className={selectedOption ? '' : 'styled-select-placeholder'}>
          {selectedOption?.label || placeholder}
        </span>
        <span aria-hidden="true" className="styled-select-chevron" />
      </button>
      {open && (
        <div className="styled-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              aria-selected={index === selectedIndex}
              className={`styled-select-option${index === activeIndex ? ' is-active' : ''}`}
              key={`${option.value}-${index}`}
              onClick={() => choose(option)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              ref={(element) => { optionRefs.current[index] = element }}
              role="option"
              tabIndex={-1}
              type="button"
            >
              <span>{option.label}</span>
              {index === selectedIndex && <span aria-hidden="true" className="styled-select-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default StyledSelect
