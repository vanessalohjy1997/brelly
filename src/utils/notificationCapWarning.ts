const IOS_NOTIFICATION_CAP = 64;
const WARNING_THRESHOLD = 50;

export type CapStatus = {
  count: number;
  cap: number;
  nearCap: boolean;
  atCap: boolean;
};

export function assessNotificationCap(scheduledCount: number): CapStatus {
  return {
    count: scheduledCount,
    cap: IOS_NOTIFICATION_CAP,
    nearCap: scheduledCount >= WARNING_THRESHOLD && scheduledCount < IOS_NOTIFICATION_CAP,
    atCap: scheduledCount >= IOS_NOTIFICATION_CAP,
  };
}
