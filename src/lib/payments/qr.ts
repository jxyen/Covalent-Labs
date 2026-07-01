import QRCode from 'qrcode'

// Server-side QR generation. Returns an inline SVG string (crisp at any size,
// no storage upload, always reflects the current handle) for the pay page to
// render. Trusted input only (owner-set handles), rendered via the deep link.
export function paymentQrSvg(text: string, size = 176): Promise<string> {
  return QRCode.toString(text, { type: 'svg', margin: 1, width: size })
}
