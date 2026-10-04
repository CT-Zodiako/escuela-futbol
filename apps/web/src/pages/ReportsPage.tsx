import { useEffect, useState } from "react";
import { Button, Card, Group, Select, Stack, Table, Tabs, Text, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { api, ApiError, type GeneralReport, type ReportSummary, type Trainer } from "../api/client";
import { isDesktop } from "../api/desktop";
import { toDateOnlyString } from "../date";
import { IconArrowLeft, IconChartBar, IconDatabaseExport, IconFileTypeXls } from "@tabler/icons-react";

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
  const [generalYear, setGeneralYear] = useState(String(new Date().getFullYear()));
  const [generalReport, setGeneralReport] = useState<GeneralReport | null>(null);
  const [isGeneralLoading, setIsGeneralLoading] = useState(false);
  const [isGeneralExporting, setIsGeneralExporting] = useState(false);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isDetailedExportLoading, setIsDetailedExportLoading] = useState(false);

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
      link.download = `pagos-${toDateOnlyString(from)}-a-${toDateOnlyString(to)}.${isDesktop ? "csv" : "xlsx"}`;
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

  async function runGeneralReport() {
    setIsGeneralLoading(true);
    try {
      setGeneralReport(await api.getGeneralReport(Number(generalYear), trainerId || undefined));
    } catch (fetchError) {
      notifications.show({ color: "red", title: "No se pudo generar el informe general", message: fetchError instanceof ApiError ? fetchError.message : "Ocurrió un error inesperado." });
    } finally {
      setIsGeneralLoading(false);
    }
  }

  async function exportGeneralReport() {
    setIsGeneralExporting(true);
    try {
      const blob = await api.exportGeneralReport(Number(generalYear), trainerId || undefined);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `informe-general-${generalYear}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(link.href);
    } catch (exportError) {
      notifications.show({ color: "red", title: "No se pudo exportar", message: exportError instanceof ApiError ? exportError.message : "Ocurrió un error inesperado." });
    } finally {
      setIsGeneralExporting(false);
    }
  }

  async function handleDatabaseBackup() {
    setIsBackupLoading(true);
    try {
      const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const targetPath = await api.exportDatabaseBackup(`escuela-futbol-backup-${dateSuffix}.sqlite3`);
      notifications.show({ color: "green", title: "Copia de seguridad lista", message: `Se guardó en: ${targetPath}` });
    } catch (backupError) {
      notifications.show({ color: "red", title: "No se pudo crear la copia", message: backupError instanceof ApiError ? backupError.message : "Ocurrió un error inesperado." });
    } finally {
      setIsBackupLoading(false);
    }
  }

  async function handleDetailedExport() {
    setIsDetailedExportLoading(true);
    try {
      const blob = await api.exportPaymentRecords();
      const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `pagos-detallados-${dateSuffix}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(link.href);
    } catch (exportError) {
      notifications.show({ color: "red", title: "No se pudo exportar", message: exportError instanceof ApiError ? exportError.message : "Ocurrió un error inesperado." });
    } finally {
      setIsDetailedExportLoading(false);
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

      <Tabs defaultValue="resumen">
        <Tabs.List>
          <Tabs.Tab value="resumen">Resumen</Tabs.Tab>
          <Tabs.Tab value="general">Informe general</Tabs.Tab>
          <Tabs.Tab value="backup">Copia de seguridad</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="resumen" pt="xl">
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
        </Tabs.Panel>

        <Tabs.Panel value="general" pt="xl">
          <Group align="flex-end" gap="md" wrap="wrap">
            <Select
              label="Entrenador"
              value={trainerId}
              onChange={(value) => { setTrainerId(value ?? ""); setGeneralReport(null); }}
              data={[{ value: "", label: "Todos los entrenadores" }, ...trainers.map((trainer) => ({ value: trainer.id, label: trainer.name }))]}
            />
            <Select label="Año" value={generalYear} onChange={(value) => { setGeneralYear(value ?? String(new Date().getFullYear())); setGeneralReport(null); }} data={Array.from({ length: 7 }, (_, index) => { const year = new Date().getFullYear() - 3 + index; return { value: String(year), label: String(year) }; })} />
            <Button color="brandBlue" onClick={runGeneralReport} loading={isGeneralLoading}>Generar informe</Button>
            <Button variant="light" color="brandBlue" leftSection={<IconFileTypeXls size={18} />} onClick={exportGeneralReport} loading={isGeneralExporting} disabled={!generalReport}>Descargar Excel</Button>
          </Group>
          {generalReport ? (
            <Card withBorder radius="md" padding={0} mt="lg" style={{ overflow: "auto" }}>
              <Table withTableBorder withColumnBorders striped highlightOnHover stickyHeader>
                <Table.Thead><Table.Tr><Table.Th>Jugador</Table.Th>{["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((month) => <Table.Th key={month} ta="right">{month}</Table.Th>)}<Table.Th ta="right">Total jugador</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {generalReport.students.map((student) => <Table.Tr key={student.studentId}><Table.Td>{student.name}</Table.Td>{student.months.map((amount, index) => <Table.Td key={index} ta="right">{amount ? formatCurrency(amount) : "—"}</Table.Td>)}<Table.Td ta="right" fw={700}>{formatCurrency(student.totalPaid)}</Table.Td></Table.Tr>)}
                  <Table.Tr fw={700}><Table.Td>Total por mes</Table.Td>{generalReport.monthlyTotals.map((amount, index) => <Table.Td key={index} ta="right">{formatCurrency(amount)}</Table.Td>)}<Table.Td ta="right">{formatCurrency(generalReport.totalCollected)}</Table.Td></Table.Tr>
                </Table.Tbody>
              </Table>
            </Card>
          ) : <Text c="dimmed" mt="lg">Elegí un año y generá el informe.</Text>}
        </Tabs.Panel>

        <Tabs.Panel value="backup" pt="xl">
          <Stack gap="lg" align="flex-start">
            <Card withBorder padding="lg" w="100%" maw={600}>
              <Stack gap="md">
                <Text fw={600}>Base de datos</Text>
                <Text size="sm" c="dimmed">
                  Descargá el archivo SQLite completo con todos los datos. Podés usarlo como copia de seguridad o abrirlo con herramientas como DB Browser for SQLite.
                </Text>
                <Button
                  color="brandBlue"
                  leftSection={<IconDatabaseExport size={18} />}
                  onClick={handleDatabaseBackup}
                  loading={isBackupLoading}
                >
                  Descargar base de datos
                </Button>
              </Stack>
            </Card>

            <Card withBorder padding="lg" w="100%" maw={600}>
              <Stack gap="md">
                <Text fw={600}>Pagos detallados</Text>
                <Text size="sm" c="dimmed">
                  Exportá un Excel con una fila por cada pago, incluyendo los datos completos del jugador.
                </Text>
                <Button
                  variant="light"
                  color="brandBlue"
                  leftSection={<IconFileTypeXls size={18} />}
                  onClick={handleDetailedExport}
                  loading={isDetailedExportLoading}
                >
                  Exportar pagos detallados
                </Button>
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
