const MAX_RECEIPT_IMAGE_BYTES = 8 * 1024 * 1024

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const ALLOWED_SUFFIXES = /\.(jpe?g|png|webp)$/i

function isAllowed(file: File): boolean {
  const type = file.type.toLowerCase()
  if (ALLOWED_TYPES.has(type)) return true
  if (type === '' || type === 'application/octet-stream') return ALLOWED_SUFFIXES.test(file.name)
  return false
}

function notAnImageError(): Error {
  return new Error('Use a JPEG, PNG, or WebP receipt image.')
}

// Rasterize to JPEG so the scanner always gets one format
// maxDimension caps the longer edge, so oversized photos shrink toward the 8 MB cap instead of failing
async function convertToJpeg(file: File, maxDimension: number): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw notAnImageError()
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw notAnImageError()
  }
  context.fillStyle = '#fff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob) throw notAnImageError()
  const base = file.name.replace(/\.[^.]+$/, '') || 'receipt'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
}

export async function prepareReceiptImage(file: File): Promise<File> {
  if (file.size === 0) throw new Error('Attach a receipt image.')

  if (isAllowed(file) && file.size <= MAX_RECEIPT_IMAGE_BYTES) {
    return file
  }

  let converted = await convertToJpeg(file, 4096)
  if (converted.size > MAX_RECEIPT_IMAGE_BYTES) {
    converted = await convertToJpeg(file, 2048)
    if (converted.size > MAX_RECEIPT_IMAGE_BYTES) {
      throw new Error('Receipt image must be 8 MB or smaller.')
    }
  }
  return converted
}
