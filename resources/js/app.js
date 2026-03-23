const COPY_TIMEOUT_MS = 1200
const TOAST_TIMEOUT_MS = 2400

const toastRoot = document.createElement('div')
toastRoot.className = 'toast-stack'
toastRoot.setAttribute('aria-live', 'polite')
toastRoot.setAttribute('aria-atomic', 'true')
document.body.append(toastRoot)

const encryptForm = document.querySelector('[data-encrypt-form]')
const encryptSecretInput = document.querySelector('[data-encrypt-secret]')

if (encryptForm && encryptSecretInput) {
  encryptForm.addEventListener('submit', (event) => {
    const secret = 'value' in encryptSecretInput ? String(encryptSecretInput.value ?? '') : ''
    if (secret.trim().length > 0) {
      return
    }

    event.preventDefault()
    if ('focus' in encryptSecretInput) {
      encryptSecretInput.focus()
    }
    showToast('You need to specify a secret before encrypting.')
  })
}

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

function showToast(message) {
  const toast = document.createElement('div')
  toast.className = 'toast toast-error'
  toast.textContent = message
  toastRoot.append(toast)

  window.setTimeout(() => {
    toast.classList.add('toast-hidden')
    window.setTimeout(() => {
      toast.remove()
    }, 220)
  }, TOAST_TIMEOUT_MS)
}
