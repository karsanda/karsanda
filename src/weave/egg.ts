/**
 * The easter egg: a message hidden in one pucuk-rebung border row.
 * ▲ = 1, ▼ = 0, 8 bits per char (MSB first), starting at index 2.
 * Every other position carries the ordinary alternating border (▲ on even
 * indices, ▼ on odd), which reads as 0xAA, a non-printable byte, so the decoder
 * stops cleanly at the end of the message with no length marker.
 */

type Bit = 0 | 1;

const START = 2;
const MAX_CHARS = 12;

const filler = (i: number): Bit => (i % 2 === 0 ? 1 : 0);
const printable = (code: number) => code >= 0x20 && code <= 0x7e;

export function borderBits(message: string, total: number): Bit[] {
  if (message.length > MAX_CHARS) throw new Error(`easter egg is limited to ${MAX_CHARS} chars`);
  const codes = [...message].map((c) => c.charCodeAt(0));
  if (codes.some((c) => !printable(c))) throw new Error('easter egg must be printable ASCII');
  if (START + codes.length * 8 > total) throw new Error('easter egg does not fit in the border');

  const bits: Bit[] = Array.from({ length: total }, (_, i) => filler(i));
  codes.forEach((code, c) => {
    for (let b = 0; b < 8; b++) bits[START + c * 8 + b] = ((code >> (7 - b)) & 1) as Bit;
  });
  return bits;
}

export function decodeBorder(bits: Bit[]): string {
  let out = '';
  for (let i = START; i + 8 <= bits.length; i += 8) {
    const code = bits.slice(i, i + 8).reduce<number>((acc, bit) => (acc << 1) | bit, 0);
    if (!printable(code)) break;
    out += String.fromCharCode(code);
  }
  return out;
}
