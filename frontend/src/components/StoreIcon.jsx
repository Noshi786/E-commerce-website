const shapes = {
  heart: <path d="M12 20s-7-4.4-8.6-9C2.4 7.9 4.1 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 2.9 0 4.6 2.9 3.6 6C19 15.6 12 20 12 20Z" />,
  box: <><path d="m12 3 8.5 4.8v8.4L12 21l-8.5-4.8V7.8L12 3Z" /><path d="m3.5 7.8 8.5 4.8 8.5-4.8M12 12.6V21" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
  logout: <><path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" /><path d="m16 8 4 4-4 4M20 12H9" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
}

function StoreIcon({ name }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24">{shapes[name]}</svg>
}

export default StoreIcon
