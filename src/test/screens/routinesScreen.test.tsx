import RoutinesScreen from "@/app/routines";
import { useCloudSyncStore } from "@/store/cloudSyncStore";
import { useRoutineStore } from "@/store/routineStore";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { Routine } from "@/types/routine";

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    label: "Office",
    location: "Downtown, Singapore",
    latitude: 1.28,
    longitude: 103.85,
    weekdays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "18:00",
    startDate: "2025-01-01",
    exceptions: [],
    ...overrides,
  };
}

beforeEach(() => {
  useRoutineStore.setState({ routines: [] });
  useCloudSyncStore.setState({
    settingsReady: true,
    routinesReady: true,
    slotsReady: true,
  });
});

describe("RoutinesScreen", () => {
  it("shows a loading skeleton before the cloud data is ready", async () => {
    useCloudSyncStore.setState({ routinesReady: false });

    const view = await renderWithProviders(<RoutinesScreen />);

    expect(view.getByText("Loading your routines…")).toBeTruthy();
    expect(view.queryByText("No routines")).toBeNull();
  });

  it("renders the empty state when there are no routines", async () => {
    const view = await renderWithProviders(<RoutinesScreen />);

    expect(view.getByText("No routines")).toBeTruthy();
    expect(
      view.getByText("Add a repeating plan and it will appear here."),
    ).toBeTruthy();
  });

  it("renders routine labels and locations", async () => {
    useRoutineStore.setState({
      routines: [
        routine({ id: "r1", label: "Office", location: "Downtown, Singapore" }),
        routine({ id: "r2", label: "Gym", location: "Orchard, Singapore" }),
      ],
    });
    const view = await renderWithProviders(<RoutinesScreen />);

    expect(view.getByText("Office")).toBeTruthy();
    expect(view.getByText("Downtown, Singapore")).toBeTruthy();
    expect(view.getByText("Gym")).toBeTruthy();
    expect(view.getByText("Orchard, Singapore")).toBeTruthy();
  });

  it("shows the exception count when a routine has exceptions", async () => {
    useRoutineStore.setState({
      routines: [
        routine({
          exceptions: ["2025-06-01", "2025-06-08", "2025-06-15"],
        }),
      ],
    });
    const view = await renderWithProviders(<RoutinesScreen />);

    expect(view.getByText("3 skipped")).toBeTruthy();
  });
});
