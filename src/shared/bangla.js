const BN = '০১২৩৪৫৬৭৮৯';

/** Converts Bangla digits (০-৯) to ASCII so spoken/typed Bangla numbers can be validated. */
export function toAsciiDigits(input) {
  return String(input ?? '').replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
}
