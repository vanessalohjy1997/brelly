import * as Notifications from "expo-notifications";

import { cancelAllNotifications } from "@brelly/platform/notifications";

const mockCancelAll =
  Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("cancelAllNotifications", () => {
  it("clears the whole OS queue", async () => {
    await cancelAllNotifications();
    expect(mockCancelAll).toHaveBeenCalledTimes(1);
  });
});
