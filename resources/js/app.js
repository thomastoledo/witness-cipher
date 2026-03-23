const COPY_TIMEOUT_MS = 1200

document.querySelectorAll('[data-copy-target]').forEach((button) => {
  button.addEventListener('click', async () => {
    const targetId = button.getAttribute('data-copy-target')
    const target = targetId ? document.getElementById(targetId) : null
    const value = target && 'value' in target ? String(target.value ?? '') : ''

    if (value.trim().length === 0) {
      return
    }

    const previousLabel = button.textContent

    try {
      await navigator.clipboard.writeText(value)
      button.textContent = 'Copied'
    } catch {
      button.textContent = 'Copy failed'
    }

    window.setTimeout(() => {
      button.textContent = previousLabel
    }, COPY_TIMEOUT_MS)
  })
})
