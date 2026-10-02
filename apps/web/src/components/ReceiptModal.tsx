import { useRef, useState } from "react";
import { Button, Group, Modal, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Payment, Student } from "../api/client";
import { IconDownload, IconPrinter } from "@tabler/icons-react";

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

const UNITS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis",
  "veintisiete", "veintiocho", "veintinueve",
];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

function wordsBelowThousand(n: number): string {
  if (n === 100) return "cien";
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);
  if (rest > 0) {
    if (rest < 30) {
      parts.push(UNITS[rest]);
    } else {
      const unit = rest % 10;
      parts.push(unit === 0 ? TENS[Math.floor(rest / 10)] : `${TENS[Math.floor(rest / 10)]} y ${UNITS[unit]}`);
    }
  }
  return parts.join(" ");
}

function wordsBelowMillion(n: number): string {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (thousands === 1) parts.push("mil");
  else if (thousands > 1) parts.push(`${wordsBelowThousand(thousands)} mil`);
  if (rest > 0) parts.push(wordsBelowThousand(rest));
  return parts.join(" ");
}

export function amountToSpanishWords(amount: number): string {
  const value = Math.floor(Math.abs(amount));
  if (value === 0) return "Cero pesos";
  const millions = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  const parts: string[] = [];
  if (millions === 1) parts.push("un millón");
  else if (millions > 1) parts.push(`${wordsBelowMillion(millions)} millones`);
  if (rest > 0) parts.push(wordsBelowMillion(rest));
  const text = parts.join(" ").replace(/veintiuno (mil|millones)/g, "veintiún $1")
    .replace(/uno (mil|millones)/g, "un $1");
  const suffix = rest === 0 ? "de pesos" : "pesos";
  const sentence = `${text} ${suffix}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function methodLabel(method: string): string {
  return method === "cash" ? "Efectivo" : method;
}

interface ReceiptModalProps {
  student: Student | null;
  payment: Payment | null;
  onClose: () => void;
}

export function ReceiptModal({ student, payment, onClose }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  async function handlePrint() {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("print_receipt");
        return;
      } catch {
        // Fall back to the browser print dialog below.
      }
    }
    window.print();
  }

  async function handleDownloadImage() {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(receiptRef.current, { backgroundColor: "#ffffff" });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se pudo generar la imagen.");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `recibo-${student?.name.replace(/\s+/g, "-").toLowerCase()}-${payment?.id.slice(0, 8)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      notifications.show({
        color: "red",
        title: "No se pudo generar la imagen",
        message: "Ocurrió un error inesperado. Intentá de nuevo.",
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Modal opened={payment !== null} onClose={onClose} title="Recibo" centered size="xl">
      {student && payment ? (
        <Stack gap="lg">
          <div ref={receiptRef} className="receipt-print-area">
            <div className="receipt-sheet">
              <div className="receipt-header">
                <div className="receipt-logo-cell">
                  <img src="/logo.png" alt="Club Deportivo Napoli F.C." className="receipt-logo" />
                </div>
                <div className="receipt-club-cell">
                  <div className="receipt-club-name">CLUB DEPORTIVO NAPOLI F.C.</div>
                  <div className="receipt-club-line receipt-bold">NIT. 901.170.843-9</div>
                  <div className="receipt-club-line">Personería Jurídica # 041 DE MARZO 21 DE 2018</div>
                  <div className="receipt-club-line">Resolución SDR # 4162.0.21.027</div>
                  <div className="receipt-club-line">Resolución LVF # 023-09</div>
                  <div className="receipt-club-split">
                    <span>Tel./Cel.:</span>
                    <span>Santiago de Cali - Colombia 2009</span>
                  </div>
                </div>
              </div>
              <div className="receipt-rule" />
              <div className="receipt-row">
                <div className="receipt-cell receipt-grow">Ciudad: Santiago de Cali</div>
                <div className="receipt-cell receipt-grow receipt-title-cell">
                  <span>COMPROBANTE DE INGRESO</span>
                  <span className="receipt-number">Nº {payment.receiptNumber ?? payment.id.slice(0, 8).toUpperCase()}</span>
                </div>
              </div>
              <div className="receipt-row">
                <div className="receipt-cell receipt-grow">Fecha: {formatDate(payment.paymentDate)}</div>
                <div className="receipt-cell receipt-grow receipt-bold">Valor: {formatCurrency(payment.amount)} COP</div>
              </div>
              <div className="receipt-row">
                <div className="receipt-cell receipt-grow">
                  Recibido de: <span className="receipt-bold">{student.name}</span>
                </div>
              </div>
              <div className="receipt-row">
                <div className="receipt-cell receipt-grow">
                  Por concepto de: {payment.concept ?? "Mensualidad escuela de fútbol"}
                </div>
              </div>
              <div className="receipt-row receipt-tall">
                <div className="receipt-cell receipt-grow">{payment.note ?? ""}</div>
              </div>
              <div className="receipt-row">
                <div className="receipt-cell receipt-grow">
                  Suma en letras: <span className="receipt-bold">{amountToSpanishWords(payment.amount)}</span>
                </div>
              </div>
              <div className="receipt-row">
                <div className="receipt-cell receipt-quarter">Cheque No.</div>
                <div className="receipt-cell receipt-quarter">Banco</div>
                <div className="receipt-cell receipt-quarter">
                  Efectivo {payment.method === "cash" ? "(X)" : ""}
                  {payment.method !== "cash" ? <div>{methodLabel(payment.method)}</div> : null}
                </div>
                <div className="receipt-cell receipt-quarter">Firma y Sello</div>
              </div>
              <div className="receipt-row receipt-footer-row">
                <div className="receipt-cell receipt-quarter">Elaborado</div>
                <div className="receipt-cell receipt-quarter">Aprobado</div>
                <div className="receipt-cell receipt-quarter">Contabilizado</div>
                <div className="receipt-cell receipt-quarter">CC o Nit. {student.document ?? ""}</div>
              </div>
            </div>
          </div>

          <Group grow>
            <Button variant="default" leftSection={<IconPrinter size={18} />} onClick={handlePrint}>
              Imprimir
            </Button>
            <Button leftSection={<IconDownload size={18} />} onClick={handleDownloadImage} loading={isDownloading}>
              Descargar imagen
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
}
