'use client'

import { useState } from 'react'
import AgregarDeudaModal from './AgregarDeudaModal'

export default function AgregarDeudaButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-600"
      >
        Agregar deuda
      </button>
      {open && <AgregarDeudaModal onClose={() => setOpen(false)} />}
    </>
  )
}
