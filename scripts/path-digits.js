/**
 * Path move counts use mathematical sans-serif bold digits 𝟬–𝟵 (U+1D7ED–U+1D7F6)
 * so they stay distinct from ASCII hex digits.
 */
const PATH_DIGIT_BASE = 0x1D7ED;
const PATH_DIR = '←→↑↓⮜⮞⮝⮟';

function pathDigitLen(cp) {
  return cp > 0xffff ? 2 : 1;
}

function readPathDigitAt(str, i) {
  const cp = str.codePointAt(i);
  if (cp >= 0x30 && cp <= 0x39) return { value: cp - 0x30, len: 1 };
  if (cp >= 0x1D7ED && cp <= 0x1D7F6) return { value: cp - 0x1D7ED, len: pathDigitLen(cp) };
  if (cp >= 0x2080 && cp <= 0x2089) return { value: cp - 0x2080, len: 1 };
  if (cp >= 0x1D7CE && cp <= 0x1D7D7) return { value: cp - 0x1D7CE, len: pathDigitLen(cp) };
  if (cp >= 0xFF10 && cp <= 0xFF19) return { value: cp - 0xFF10, len: 1 };
  return null;
}

function toPathDigit(ch) {
  return String.fromCodePoint(PATH_DIGIT_BASE + (ch.charCodeAt(0) - 48));
}

function toPathDigits(asciiDigits) {
  return asciiDigits.replace(/[0-9]/g, (ch) => toPathDigit(ch));
}

function convertPathDigits(pathStr) {
  let out = '';
  let i = 0;
  while (i < pathStr.length) {
    const c = pathStr[i];
    out += c;
    i++;
    if (PATH_DIR.includes(c)) {
      let ascii = '';
      while (i < pathStr.length) {
        const d = readPathDigitAt(pathStr, i);
        if (!d) break;
        ascii += String(d.value);
        i += d.len;
      }
      if (ascii) out += toPathDigits(ascii);
    }
  }
  return out;
}

module.exports = {
  PATH_DIGIT_BASE,
  PATH_DIR,
  toPathDigit,
  toPathDigits,
  convertPathDigits
};
