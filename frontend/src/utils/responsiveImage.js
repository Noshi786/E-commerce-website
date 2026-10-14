export function responsiveImage(source, widths) {
  if (!source) return { src: source }

  try {
    const original = new URL(source, 'http://localhost')
    if (original.hostname !== 'images.unsplash.com') return { src: source }

    const createVariant = (width) => {
      const url = new URL(original)
      url.searchParams.set('auto', 'format')
      url.searchParams.set('fit', 'crop')
      url.searchParams.set('w', String(width))
      url.searchParams.set('q', '72')
      return url.toString()
    }

    return {
      src: createVariant(widths[widths.length - 1]),
      srcSet: widths.map((width) => `${createVariant(width)} ${width}w`).join(', '),
    }
  } catch {
    return { src: source }
  }
}
