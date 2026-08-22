import type { TransferPaymentDetails } from "@/types/gestion";
import type { PortalPaymentObligation } from "@/types/portal";

export const emptyTransferDetails: TransferPaymentDetails = {
  holder: "",
  alias: "",
  accountNumber: "",
  institution: "",
};

export function normalizeTransferDetails(value?: Partial<TransferPaymentDetails> | null): TransferPaymentDetails {
  return {
    holder: value?.holder?.trim() ?? "",
    alias: value?.alias?.trim() ?? "",
    accountNumber: value?.accountNumber?.replace(/\s+/g, "").trim() ?? "",
    institution: value?.institution?.trim() ?? "",
  };
}

export function validateTransferDetails(value?: Partial<TransferPaymentDetails> | null) {
  const details = normalizeTransferDetails(value);
  if (details.holder.length > 120) return "El titular de la transferencia es demasiado extenso.";
  if (details.alias.length > 80) return "El alias de transferencia es demasiado extenso.";
  if (details.accountNumber.length > 40) return "El CBU o CVU es demasiado extenso.";
  if (details.institution.length > 120) return "El banco o billetera es demasiado extenso.";
  return null;
}

export function hasTransferDetails(value?: Partial<TransferPaymentDetails> | null) {
  const details = normalizeTransferDetails(value);
  return Boolean(details.alias || details.accountNumber);
}

export function openTransferObligations(obligations: PortalPaymentObligation[]) {
  return obligations.filter((obligation) =>
    obligation.balance > 0
    && obligation.status !== "PAID"
    && obligation.status !== "VOID",
  );
}

export function transferCopyText(details: TransferPaymentDetails, amount: number) {
  const rows = [
    "Transferencia BM Training",
    details.holder && `Titular: ${details.holder}`,
    details.alias && `Alias: ${details.alias}`,
    details.accountNumber && `CBU/CVU: ${details.accountNumber}`,
    details.institution && `Banco/billetera: ${details.institution}`,
    amount > 0 && `Importe: ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount)}`,
  ].filter(Boolean);
  return rows.join("\n");
}
