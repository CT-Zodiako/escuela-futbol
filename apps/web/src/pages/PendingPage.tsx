import { useState } from "react";
import { Badge, Button, Group, Stack, Table, Text, Title } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { api, ApiError, type PendingReport, type Student } from "../api/client";
import { IconArrowLeft, IconHistory, IconSearch } from "@tabler/icons-react";

function currentMonthDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

interface PendingPageProps {
  onBack: () => void;
  onOpenHistory: (student: Student) => void;
  students: Student[];
}

export function PendingPage({ onBack, onOpenHistory, students }: PendingPageProps) {
  const [month, setMonth] = useState<Date | null>(currentMonthDate());
  const [report, setReport] = useState<PendingReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadReport() {
    if (!month) return;
    setIsLoading(true);
    try {
      const result = await api.getPendingReport(toMonthString(month));
      setReport(result);
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No se pudo cargar el mes",
        message: error instanceof ApiError ? error.message : "Ocurrió un error inesperado.",
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsLoading(false);
    }
  }

  function findStudent(studentId: string): Student | undefined {
    return students.find((s) => s.id === studentId);
  }

  return (
    <Stack p="xl" gap="xl">
      <Group justify="space-between">
        <Title order={2}>Pagos pendientes</Title>
        <Button variant="default" leftSection={<IconArrowLeft size={18} />} onClick={onBack}>
          Volver
        </Button>
      </Group>

      <Group align="flex-end" gap="md" wrap="wrap">
        <MonthPickerInput
          label="Mes"
          valueFormat="MMMM YYYY"
          value={month}
          onChange={setMonth}
          popoverProps={{ withinPortal: true }}
        />
        <Button leftSection={<IconSearch size={18} />} onClick={loadReport} loading={isLoading}>
          Consultar
        </Button>
      </Group>

      {report && report.students.length === 0 ? (
        <Text c="dimmed">No hay jugadores activos para este mes.</Text>
      ) : report ? (
        <Stack gap="lg">
          <Group gap="lg">
            <Text>
              <b>{report.paidCount}</b> pagaron
            </Text>
            <Text>
              <b>{report.pendingCount}</b> pendientes
            </Text>
          </Group>

          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Jugador</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.students.map((student) => (
                <Table.Tr key={student.studentId}>
                  <Table.Td>{student.name}</Table.Td>
                  <Table.Td>
                    {student.status === "paid" ? (
                      <Badge color="green">Pagado</Badge>
                    ) : (
                      <Badge color="orange">Pendiente</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<IconHistory size={14} />}
                      onClick={() => {
                        const full = findStudent(student.studentId);
                        if (full) onOpenHistory(full);
                      }}
                    >
                      Ver historial
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      ) : null}
    </Stack>
  );
}
