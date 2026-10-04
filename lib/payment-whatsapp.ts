import { normalizeArgentineWhatsAppPhone } from "./argentine-phone.ts";

export function paymentWhatsappUrl(phone: string, message: string): string | null {
  const normalized = normalizeArgentineWhatsAppPhone(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : null;
}
