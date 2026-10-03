import { useEffect, useState } from "react";
import { Button, Card, Group, Select, Stack, Table, Text, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { api, ApiError, type ReportSummary, type Trainer } from "../api/client";
import { toDateOnlyString } from "../date";
import { IconArrowLeft, IconChartBar, IconFileTypeXls } from "@tabler/icons-react";

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}

function firstDayOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

interface ReportsPageProps {
  onBack: () => void;
}

export function ReportsPage({ onBack }: ReportsPageProps) {
  const [from, setFrom] = useState<Date | null>(firstDayOfCurrentMonth());
  const [to, setTo] = useState<Date | null>(new Date());
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerId, setTrainerId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    api.listTrainers().then((result) => {
      if (!cancelled) setTrainers(result);
    }).catch((loadError) => {
      if (!cancelled) notifications.show({
        color: "red",
        title: "No se pudieron cargar los entrenadores",
        message: loadError instanceof ApiError ? loadError.message : "Ocurrió un error inesperado.",
      });
    });
    return () => { cancelled = true; };
  }, []);

  async function handleExport() {
    if (!from || !to) return;
    setIsExporting(true);
    try {
      const blob = await api.exportPayments(toDateOnlyString(from), toDateOnlyString(to), trainerId || undefined);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `pagos-${toDateOnlyString(from)}-a-${toDateOnlyString(to)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (exportError) {
      notifications.show({
        color: "red",
        title: "No se pudo exportar",
        message:
          exportError instanceof ApiError ? exportError.message : "Ocurrió un error inesperado.",
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function runReport() {
    if (!from || !to) return;
    if (from > to) {
      setError("La fecha final debe ser posterior o igual a la inicial.");
      setSummary(null);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await api.getReportSummary(toDateOnlyString(from), toDateOnlyString(to), trainerId || undefined);
      setSummary(result);
    } catch (fetchError) {
      notifications.show({
        color: "red",
        title: "No se pudo generar el reporte",
        message:
          fetchError instanceof ApiError ? fetchError.message : "Ocurrió un error inesperado.",
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Stack p="xl" gap="xl">
      <Group justify="space-between">
        <Title order={2}>Reportes</Title>
        <Button variant="default" leftSection={<IconArrowLeft size={18} />} onClick={onBack}>
          Volver
        </Button>
      </Group>

      <Group align="flex-end" gap="md" wrap="wrap">
        <Select
          label="Entrenador"
          value={trainerId}
          onChange={(value) => { setTrainerId(value ?? ""); setSummary(null); }}
          data={[
            { value: "", label: "Todos los entrenadores" },
            ...trainers.map((trainer) => ({ value: trainer.id, label: trainer.name })),
          ]}
        />
        <DateInput
          label="Desde"
          valueFormat="DD/MM/YYYY"
          value={from}
          onChange={setFrom}
          error={error ?? undefined}
          popoverProps={{ withinPortal: true }}
        />
        <DateInput
          label="Hasta"
          valueFormat="DD/MM/YYYY"
          value={to}
          onChange={setTo}
          popoverProps={{ withinPortal: true }}
        />
        <Button color="brandBlue" variant="filled" leftSection={<IconChartBar size={18} />} onClick={runReport} loading={isLoading}>
          Generar Reportes
        </Button>
        <Button variant="light" color="brandBlue" leftSection={<IconFileTypeXls size={18} />} onClick={handleExport} loading={isExporting}>
          Exportar Excel
        </Button>
      </Group>

      {summary && summary.paymentsCount === 0 ? (
        <Text c="dimmed">No hay pagos registrados en este período.</Text>
      ) : summary ? (
        <Stack gap="lg">
          <Group gap="lg">
            <Card withBorder padding="lg">
              <Text size="sm" c="dimmed">
                Total recaudado
              </Text>
              <Text size="xl" fw={700}>
                {formatCurrency(summary.totalCollected)}
              </Text>
            </Card>
            <Card withBorder padding="lg">
              <Text size="sm" c="dimmed">
                Jugadores que pagaron
              </Text>
              <Text size="xl" fw={700}>
                {summary.studentsPaidCount}
              </Text>
            </Card>
          </Group>

          <Card withBorder radius="md" padding={0} style={{ overflow: "hidden" }}>
            <Table
              withTableBorder
              withColumnBorders
              striped
              highlightOnHover
              verticalSpacing="sm"
              horizontalSpacing="lg"
            >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Jugador</Table.Th>
                <Table.Th>Total pagado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.paidStudents.map((student) => (
                <Table.Tr key={student.studentId}>
                  <Table.Td>{student.name}</Table.Td>
                  <Table.Td>{formatCurrency(student.totalPaid)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            </Table>
          </Card>
        </Stack>
      ) : null}
    </Stack>
  );
}
