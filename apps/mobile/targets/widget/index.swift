import WidgetKit
import SwiftUI

// MARK: - Shared snapshot model
//
// Decodes the JSON that the app writes into the App Group via
// `writeWidgetSnapshot` (`src/services/widgetBridge.ts`). This mirrors
// `WidgetSnapshot` in `src/services/widgetSnapshot.ts` field for field — the
// two processes share no types, only this shape, so a field added on the JS
// side has to be added here too.

struct WidgetSnapshot: Decodable {
    let generatedAt: String
    let next: NextSlot?
}

struct NextSlot: Decodable {
    let label: String
    let location: String
    let startTime: String
    let forecastText: String?
    let temperature: Temperature?
    let umbrella: Umbrella?

    struct Temperature: Decodable {
        let low: Double
        let high: Double
    }

    struct Umbrella: Decodable {
        let needed: Bool
        let reason: String
        let shortLabel: String
    }
}

// MARK: - App Group read

enum SnapshotStore {
    // Must match the App Group in `app.json` (`ios.entitlements`),
    // `expo-target.config.js`, and `WIDGET_APP_GROUP` in `widgetBridge.ts`.
    static let appGroup = "group.com.sg.brelly.app"
    static let key = "nextSlot"

    static func read() -> WidgetSnapshot? {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let raw = defaults.string(forKey: key),
            let data = raw.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }
}

private let isoFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    // JS `Date.toISOString()` always carries fractional seconds and a `Z`.
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
}()

private func parseDate(_ value: String) -> Date? {
    isoFormatter.date(from: value)
}

// MARK: - Timeline

struct BrellyEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> BrellyEntry {
        BrellyEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (BrellyEntry) -> Void) {
        completion(BrellyEntry(date: Date(), snapshot: SnapshotStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BrellyEntry>) -> Void) {
        let entry = BrellyEntry(date: Date(), snapshot: SnapshotStore.read())
        // The app rewrites the snapshot and calls `reloadWidget` on every
        // foreground and notification sync, so this timeline is mostly a
        // safety net for when the app is never reopened: refresh in an hour.
        let refresh = Calendar.current.date(byAdding: .hour, value: 1, to: entry.date)
            ?? entry.date.addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

// MARK: - Verdict presentation

private struct VerdictStyle {
    let symbol: String
    let tint: Color
    let label: String
}

private func verdictStyle(for slot: NextSlot) -> VerdictStyle {
    guard let umbrella = slot.umbrella else {
        // The app could not load a forecast for this stop — say so rather than
        // imply "clear". Matches the `umbrella: null` state in the JS snapshot.
        return VerdictStyle(symbol: "cloud.slash", tint: .secondary, label: "No forecast")
    }
    switch umbrella.reason {
    case "rain", "both":
        return VerdictStyle(symbol: "umbrella.fill", tint: Color("umbrellaRain"), label: umbrella.shortLabel)
    case "sun":
        return VerdictStyle(symbol: "sun.max.fill", tint: Color("umbrellaSun"), label: umbrella.shortLabel)
    default:
        return VerdictStyle(symbol: "checkmark", tint: .secondary, label: umbrella.shortLabel)
    }
}

// MARK: - Card decoration

// The accent bar and watermark that only a real rain/sun verdict earns. A clear
// stop or a missing forecast gets neither, the same restraint `ItineraryCard`
// applies — its `accent` is null and its watermark is guarded on
// `reason !== "none"`. Kept apart from `verdictStyle` because that one still
// answers for the "clear" (checkmark) and "No forecast" states, which draw no
// decoration here.
private struct Decoration {
    let symbol: String
    let tint: Color
}

private func decoration(for slot: NextSlot) -> Decoration? {
    guard let umbrella = slot.umbrella else { return nil }
    switch umbrella.reason {
    case "rain", "both":
        return Decoration(symbol: "umbrella.fill", tint: Color("umbrellaRain"))
    case "sun":
        return Decoration(symbol: "sun.max.fill", tint: Color("umbrellaSun"))
    default:
        return nil
    }
}

// MARK: - Views

struct BrellyWidgetView: View {
    @Environment(\.widgetFamily) private var family
    var entry: BrellyEntry

    var body: some View {
        Group {
            if let slot = entry.snapshot?.next {
                switch family {
                case .accessoryInline:
                    inlineView(slot)
                case .accessoryRectangular:
                    rectangularView(slot)
                default:
                    homeView(slot)
                }
            } else {
                emptyView
            }
        }
        .widgetBackground { backgroundView }
    }

    // The plan card's surface, rebuilt for the widget: the violet fill, a
    // verdict-tinted bar down the leading edge, and the same umbrella/sun mark
    // as a faint watermark bleeding off the bottom-right corner. Placed in the
    // container background so it sits behind the glance, and the system clips it
    // to the widget's rounded corners — the way `ItineraryCard`'s
    // `overflow: "hidden"` clips its own bar and watermark.
    @ViewBuilder
    private var backgroundView: some View {
        // Lock-screen (accessory) families are rendered by the system in a
        // desaturated/tinted mode, so a background there only fights it.
        if family == .systemSmall || family == .systemMedium {
            ZStack {
                Color("cardBackground")
                if let slot = entry.snapshot?.next,
                   let decoration = decoration(for: slot) {
                    Rectangle()
                        .fill(decoration.tint)
                        .frame(width: 4)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

                    // The verdict as a picture bleeding off the corner, matching
                    // the card's watermark: large, faint (0.14), clipped by the
                    // rounded container. A single SF Symbol stands in for the
                    // card's drawn umbrella-and-marks — the same symbol the
                    // glance already uses for this verdict.
                    Image(systemName: decoration.symbol)
                        .font(.system(size: 96))
                        .foregroundStyle(decoration.tint)
                        .opacity(0.14)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                        .offset(x: 20, y: 24)
                }
            }
        } else {
            Color.clear
        }
    }

    // Home-screen small/medium: the full glance.
    private func homeView(_ slot: NextSlot) -> some View {
        let style = verdictStyle(for: slot)
        return VStack(alignment: .leading, spacing: 6) {
            if let start = parseDate(slot.startTime) {
                Text(start, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Text(slot.label)
                .font(.headline)
                .lineLimit(1)

            Text(slot.location)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Spacer(minLength: 0)

            // The small family is too narrow to seat the verdict and the
            // fixed-width temperature on one row: the temperature starves the
            // verdict, and "Clear" — or the longer "Rain · sun" — breaks
            // mid-word ("Clea / r"). Stack them there so each gets the full
            // width and stays on one line. The medium family has the room, so
            // it keeps the side-by-side row.
            if family == .systemSmall {
                VStack(alignment: .leading, spacing: 2) {
                    temperatureText(slot)
                    verdictLabel(style)
                }
            } else {
                HStack(spacing: 6) {
                    verdictLabel(style)
                    Spacer(minLength: 0)
                    temperatureText(slot)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    // The umbrella verdict — icon plus word, in the verdict's own tint. Held to
    // one line so the small family can never wrap it mid-letter again.
    @ViewBuilder
    private func verdictLabel(_ style: VerdictStyle) -> some View {
        Label {
            Text(style.label)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
        } icon: {
            Image(systemName: style.symbol)
        }
        .foregroundStyle(style.tint)
        .labelStyle(.titleAndIcon)
    }

    // The stop's temperature range, or nothing when the forecast carried none.
    @ViewBuilder
    private func temperatureText(_ slot: NextSlot) -> some View {
        if let temperature = slot.temperature {
            Text("\(Int(temperature.low.rounded()))–\(Int(temperature.high.rounded()))°")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // Lock-screen rectangular: two tight lines, no colour.
    private func rectangularView(_ slot: NextSlot) -> some View {
        let style = verdictStyle(for: slot)
        return VStack(alignment: .leading, spacing: 2) {
            Text(slot.label)
                .font(.headline)
                .lineLimit(1)
            HStack(spacing: 4) {
                Image(systemName: style.symbol)
                Text(style.label)
                if let start = parseDate(slot.startTime) {
                    Text("· \(start, style: .time)")
                }
            }
            .font(.caption)
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // Lock-screen inline: one line above the clock.
    private func inlineView(_ slot: NextSlot) -> some View {
        let style = verdictStyle(for: slot)
        return Label {
            Text("\(style.label) · \(slot.label)")
        } icon: {
            Image(systemName: style.symbol)
        }
    }

    private var emptyView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: "umbrella")
                .foregroundStyle(.secondary)
            Text("Nothing upcoming")
                .font(.headline)
                .lineLimit(1)
            if family == .systemSmall || family == .systemMedium {
                Text("Plan a stop in Brelly")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// A `containerBackground` is required on iOS 17+ for the widget to draw
// edge-to-edge; on iOS 16 the family still renders without it.
private extension View {
    @ViewBuilder
    func widgetBackground<Background: View>(
        @ViewBuilder _ background: () -> Background
    ) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { background() }
        } else {
            self.background { background() }
        }
    }
}

// MARK: - Widget

struct BrellyWidget: Widget {
    // Must equal `WIDGET_KIND` in `src/services/widgetBridge.ts`, or the app's
    // `reloadWidget(kind)` refreshes nothing.
    let kind = "brellyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            BrellyWidgetView(entry: entry)
        }
        .configurationDisplayName("Next stop")
        .description("The weather for your next planned stop.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

@main
struct BrellyWidgetBundle: WidgetBundle {
    var body: some Widget {
        BrellyWidget()
    }
}
