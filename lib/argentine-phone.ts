const ARGENTINA_COUNTRY_CODE = "54";
const ARGENTINA_MOBILE_PREFIX = "549";
const NATIONAL_NUMBER_LENGTH = 10;

function removeLocalMobilePrefix(value: string) {
  if (value.length !== NATIONAL_NUMBER_LENGTH + 2) return value;
  const positions = [2, 3, 4].filter((position) => value.slice(position, position + 2) === "15");
  if (positions.length !== 1) return value;
  const position = positions[0];
  return `${value.slice(0, position)}${value.slice(position + 2)}`;
}

export function normalizeArgentineWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith(ARGENTINA_MOBILE_PREFIX)) {
    return digits.length === ARGENTINA_MOBILE_PREFIX.length + NATIONAL_NUMBER_LENGTH ? digits : null;
  }

  let national = digits.startsWith(ARGENTINA_COUNTRY_CODE)
    ? digits.slice(ARGENTINA_COUNTRY_CODE.length)
    : digits;
  if (national.startsWith("0")) national = national.slice(1);
  national = removeLocalMobilePrefix(national);

  if (national.length !== NATIONAL_NUMBER_LENGTH) return null;
  return `${ARGENTINA_MOBILE_PREFIX}${national}`;
}
