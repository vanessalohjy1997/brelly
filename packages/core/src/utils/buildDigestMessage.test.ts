import { buildDigestMessage, type DigestEntry } from "@/utils/buildDigestMessage";

const NOW = new Date(2026, 6, 31, 7, 30);

function entry(
  label: string,
  hour: number,
  forecastText: string | null,
): DigestEntry {
  return {
    label,
    startTime: new Date(2026, 6, 31, hour, 0).toISOString(),
    forecastText,
  };
}

describe("buildDigestMessage", () => {
  it("returns null when there are no plans", () => {
    expect(buildDigestMessage([], NOW)).toBeNull();
  });

  it("reports a dry day without naming stops", () => {
    const message = buildDigestMessage(
      [entry("Gym", 9, "Fair (Day)"), entry("Dinner", 19, "Partly Cloudy")],
      NOW,
    );

    expect(message).toEqual({
      title: "Today's plans",
      body: "2 stops, no rain forecast.",
    });
  });

  it("uses the singular for one stop", () => {
    const message = buildDigestMessage([entry("Gym", 9, "Cloudy")], NOW);
    expect(message?.body).toBe("1 stop, no rain forecast.");
  });

  it("names the wet stops with their times", () => {
    const message = buildDigestMessage(
      [entry("Gym", 9, "Fair (Day)"), entry("Picnic", 16, "Thundery Showers")],
      NOW,
    );

    expect(message?.title).toBe("Umbrella today");
    expect(message?.body).toMatch(/^2 stops, rain expected for Picnic \(4:00 pm\)\.$/i);
  });

  it("counts the overflow instead of listing every wet stop", () => {
    const message = buildDigestMessage(
      [
        entry("Gym", 9, "Showers"),
        entry("Lunch", 12, "Light Rain"),
        entry("Picnic", 16, "Thundery Showers"),
      ],
      NOW,
    );

    expect(message?.body).toContain("+1 more");
    expect(message?.body).not.toContain("Picnic");
  });

  it("does not count a stop whose forecast couldn't be loaded as wet", () => {
    const message = buildDigestMessage(
      [entry("Gym", 9, null), entry("Lunch", 12, null)],
      NOW,
    );

    expect(message?.body).toBe("2 stops, no rain forecast.");
  });

  it("still counts unknown-forecast stops in the total", () => {
    const message = buildDigestMessage(
      [entry("Gym", 9, null), entry("Picnic", 16, "Showers")],
      NOW,
    );

    expect(message?.body).toContain("2 stops");
  });

  it("titles a digest for a different day generically", () => {
    const tomorrow = {
      label: "Picnic",
      startTime: new Date(2026, 7, 1, 16, 0).toISOString(),
      forecastText: "Cloudy",
    };

    expect(buildDigestMessage([tomorrow], NOW)?.title).toBe("Your plans");
  });
});
