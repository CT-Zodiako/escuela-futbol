import { useCallback, useEffect, useState } from "react";
import { isDesktop } from "../api/desktop";
import { SyncPanel } from "../api/SyncPanel";
import { UpdatePanel } from "../api/UpdatePanel";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Pagination,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useElementSize, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconChartBar,
  IconClockExclamation,
  IconDotsVertical,
  IconHistory,
  IconLogout,
  IconSearch,
  IconUserCheck,
  IconUserOff,
  IconUserPlus,
  IconCash,
} from "@tabler/icons-react";
import { api, ApiError, type Student, type Trainer } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { TrainerFormModal } from "../components/TrainerFormModal";
import { StudentFormModal } from "../components/StudentFormModal";
import { PaymentFormModal } from "../components/PaymentFormModal";
import { StudentHistoryModal } from "../components/StudentHistoryModal";
import { ReportsPage } from "./ReportsPage";
import { PendingPage } from "./PendingPage";

const DESKTOP_ROW_HEIGHT = 67;
const DESKTOP_HEADER_HEIGHT = 64;
const MOBILE_CARD_HEIGHT = 288;

export function DashboardPage() {
  const { signOut } = useAuth();
  const isNarrowScreen = useMediaQuery("(max-width: 640px)");
  const [students, setStudents] = useState<Student[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrainerModalOpen, setIsTrainerModalOpen] = useState(false);
  const [trainerRevision, setTrainerRevision] = useState(0);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [view, setView] = useState<"students" | "reports" | "pending">(
    "students",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const { ref: listAreaRef, height: listAreaHeight } = useElementSize();

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const trainerNameById = new Map(
    trainers.map((trainer) => [trainer.id, trainer.name]),
  );
  const trainerNameFor = (student: Student) =>
    student.trainerId
      ? (trainerNameById.get(student.trainerId) ?? "—")
      : "—";
  const filteredStudents = normalizedSearch
    ? students.filter((student) =>
        [student.name, student.document, student.phone]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(normalizedSearch)),
      )
    : students;

  const rowsPerPage = isNarrowScreen
    ? Math.max(1, Math.floor(listAreaHeight / MOBILE_CARD_HEIGHT))
    : Math.max(
        1,
        Math.floor(
          (listAreaHeight - DESKTOP_HEADER_HEIGHT) / DESKTOP_ROW_HEIGHT,
        ),
      );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / rowsPerPage),
  );
  const currentPage = Math.min(page, totalPages);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, isNarrowScreen]);

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.listStudents();
      setStudents(data);
      try {
        setTrainers(await api.listTrainers());
      } catch {
        // Roster stays usable without trainer names; keep the last known list.
      }
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No se pudo cargar la lista",
        message:
          error instanceof ApiError
            ? error.message
            : "Ocurrió un error inesperado.",
        autoClose: 5000,
        withCloseButton: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents, trainerRevision]);

  async function handleToggleStatus(student: Student) {
    if (student.isActive) {
      const confirmed = window.confirm(
        `¿Desactivar a ${student.name}? No se le generarán nuevas mensualidades hasta que lo reactivés. Su historial se conserva.`,
      );
      if (!confirmed) return;
    }
    try {
      const updated = await api.setStudentStatus(student.id, !student.isActive);
      setStudents((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
      notifications.show({
        color: "green",
        title: updated.isActive
          ? "Jugador activado"
          : "Jugador desactivado",
        message: `${updated.name} ahora está ${updated.isActive ? "activo" : "inactivo"}.`,
        autoClose: 5000,
        withCloseButton: true,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No se pudo actualizar el estado",
        message:
          error instanceof ApiError
            ? error.message
            : "Ocurrió un error inesperado.",
        autoClose: 5000,
        withCloseButton: true,
      });
    }
  }

  if (view === "reports") {
    return <ReportsPage onBack={() => setView("students")} />;
  }

  if (view === "pending") {
    return (
      <PendingPage
        onBack={() => setView("students")}
        students={students}
        onOpenHistory={(student) => {
          setView("students");
          setHistoryStudent(student);
        }}
      />
    );
  }

  const hasStudents = students.length > 0;
  const showEmptyState = !isLoading && !hasStudents;
  const showNoMatch =
    !showEmptyState && !isLoading && filteredStudents.length === 0;
  const showResults = !showEmptyState && !showNoMatch && !isLoading;

  return (
    <Stack h="100dvh" p="xl" gap="xl" style={{ overflow: "hidden" }}>
      <Group justify="space-between">
        <Group>
          <Title order={2}>Escuela Futbol</Title>
          {isDesktop && <UpdatePanel />}
        </Group>
        {isNarrowScreen ? (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="Más opciones">
                <IconDotsVertical size={22} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconClockExclamation size={16} />}
                onClick={() => setView("pending")}
              >
                Pagos Pendientes
              </Menu.Item>
              <Menu.Item
                leftSection={<IconChartBar size={16} />}
                onClick={() => setView("reports")}
              >
                Generar Reportes
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={16} />}
                onClick={signOut}
              >
                Cerrar sesión
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <Group>
            <Button
              variant="light"
              leftSection={<IconClockExclamation size={18} />}
              onClick={() => setView("pending")}
            >
              Pagos Pendientes
            </Button>
            <Button
              variant="light"
              leftSection={<IconChartBar size={18} />}
              onClick={() => setView("reports")}
            >
              Generar Reportes
            </Button>
            <Button
              variant="outline"
              color="red"
              leftSection={<IconLogout size={18} />}
              onClick={signOut}
            >
              Cerrar sesión
            </Button>
          </Group>
        )}
      </Group>

      {isDesktop && <SyncPanel />}

      <Group justify="space-between">
        <Title order={3}>Jugadores</Title>
        <Button variant="light" onClick={() => setIsTrainerModalOpen(true)}>Registrar entrenador</Button>
        <Button
          leftSection={<IconUserPlus size={18} />}
          onClick={() => setIsStudentModalOpen(true)}
        >
          Registrar jugador
        </Button>
      </Group>

      <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
        {!showEmptyState && (
          <TextInput
            placeholder="Buscar jugador"
            aria-label="Buscar jugador"
            leftSection={<IconSearch size={18} />}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.currentTarget.value)}
          />
        )}

        <div
          ref={listAreaRef}
          style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          {showEmptyState ? (
            <Stack align="center" gap="md" py="xl">
              <Text c="dimmed">Todavía no hay jugadores registrados.</Text>
              <Button
                leftSection={<IconUserPlus size={18} />}
                onClick={() => setIsStudentModalOpen(true)}
              >
                Registrar primer jugador
              </Button>
            </Stack>
          ) : showNoMatch ? (
            <Text c="dimmed" ta="center" py="xl">
              Ningún jugador coincide con “{searchTerm}”.
            </Text>
          ) : showResults ? (
            isNarrowScreen ? (
              <Stack gap="md">
                {paginatedStudents.map((student) => (
                  <Card key={student.id} withBorder padding="lg">
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={600}>{student.name}</Text>
                        <Badge color={student.isActive ? "green" : "gray"}>
                          {student.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        Documento: {student.document ?? "—"}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Teléfono: {student.phone ?? "—"}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Entrenador: {trainerNameFor(student)}
                      </Text>
                      <Stack gap="xs">
                        <Button
                          variant="light"
                          leftSection={<IconCash size={16} />}
                          fullWidth
                          disabled={!student.isActive}
                          onClick={() => setPaymentStudent(student)}
                        >
                          Registrar pago
                        </Button>
                        <Button
                          variant="default"
                          leftSection={<IconHistory size={16} />}
                          fullWidth
                          onClick={() => setHistoryStudent(student)}
                        >
                          Ver Historial Pagos
                        </Button>
                        <Button
                          variant="light"
                          color={student.isActive ? "red" : "green"}
                          leftSection={
                            student.isActive ? (
                              <IconUserOff size={16} />
                            ) : (
                              <IconUserCheck size={16} />
                            )
                          }
                          fullWidth
                          style={{ display: isDesktop ? "none" : undefined }}
                          onClick={() => handleToggleStatus(student)}
                        >
                          {student.isActive ? "Desactivar" : "Activar"}
                        </Button>
                      </Stack>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Table verticalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Documento</Table.Th>
                    <Table.Th>Teléfono</Table.Th>
                    <Table.Th>Entrenador</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th></Table.Th>
                    <Table.Th></Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedStudents.map((student) => (
                    <Table.Tr key={student.id}>
                      <Table.Td>
                        {student.name}
                      </Table.Td>
                      <Table.Td>{student.document ?? "—"}</Table.Td>
                      <Table.Td>{student.phone ?? "—"}</Table.Td>
                      <Table.Td>{trainerNameFor(student)}</Table.Td>
                      <Table.Td>
                        <Badge color={student.isActive ? "green" : "gray"}>
                          {student.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="light"
                          leftSection={<IconCash size={16} />}
                          disabled={!student.isActive}
                          onClick={() => setPaymentStudent(student)}
                        >
                          Registrar pago
                        </Button>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="default"
                          leftSection={<IconHistory size={16} />}
                          onClick={() => setHistoryStudent(student)}
                        >
                          Ver Historial Pagos
                        </Button>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="light"
                          color={student.isActive ? "red" : "green"}
                          leftSection={
                            student.isActive ? (
                              <IconUserOff size={16} />
                            ) : (
                              <IconUserCheck size={16} />
                            )
                          }
                          style={{ display: isDesktop ? "none" : undefined }}
                          onClick={() => handleToggleStatus(student)}
                        >
                          {student.isActive ? "Desactivar" : "Activar"}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )
          ) : null}
        </div>

        {showResults && totalPages > 1 ? (
          <Group justify="center">
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={setPage}
            />
          </Group>
        ) : null}
      </Stack>

      <TrainerFormModal
        opened={isTrainerModalOpen}
        onClose={() => setIsTrainerModalOpen(false)}
        onCreated={() => setTrainerRevision((value) => value + 1)}
      />
      <StudentFormModal
        trainerRevision={trainerRevision}
        opened={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onCreated={(student) => {
          if (isDesktop) void loadStudents();
          else setStudents((prev) => [...prev, student]);
        }}
      />

      <PaymentFormModal
        opened={paymentStudent !== null}
        student={paymentStudent}
        onClose={() => setPaymentStudent(null)}
        onCreated={() => {
          if (isDesktop) setHistoryStudent(paymentStudent);
        }}
      />

      <StudentHistoryModal
        student={historyStudent}
        onClose={() => setHistoryStudent(null)}
      />
    </Stack>
  );
}
