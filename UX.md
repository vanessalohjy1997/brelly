# Brelly UX

Open UX work, plus the handful of standing constraints that have no other home.

Status key: `[ ]` open. Nothing here is closed — a closed item gets deleted, not
ticked.

**What happened to the rest of this file.** It used to carry every UX item ever
raised, done ones included, each with the full reasoning behind the fix. Those
are gone. The round-by-round write-up lives in
[NOTES.md](NOTES.md#round-history), and the reasoning that constrains future
work now sits as a comment beside the code it explains — `theme.ts` carries
every contrast ratio and why each token exists, `describeUv.ts` carries why sun
never notifies, `appTabs.tsx` carries the iOS 26 tab-bar flag,
`shouldStackDateTimeFields.ts` carries the SwiftUI picker's missing intrinsic
size, `useDeleteSlotWithUndo.ts` carries why delete has an undo and not a
dialog. A second copy here would only go stale against the first.

What is kept below is what is still open, and what is true across several files
at once so no single file owns it.

Note for anyone adding to this file: `.claude/hooks/session-context.sh` injects
`[ ]` items only, each under the heading it sits below. Anything written
outside a `[ ]` bullet is read, never injected.

---

## Open

### Today

- [ ] **The header never collapses.** `HeaderHeight` is a fixed 80
  ([theme.ts:186](src/constants/theme.ts#L186)) with the title sitting above the
  `ScrollView`. The cheap half of this already shipped — the title went 48/52 →
  34/40 and the header 108 → 80. The real version is blocked on a constraint,
  not on effort: the height is fixed *on purpose*, because Today (title + date)
  and Plans (title only) would otherwise shift content when you switch tabs. A
  scroll-driven collapsing title has to resolve that first rather than work
  around it.

  **Diverged on web (round 39).** The constraint is native-only. `apps/web`
  navigates from a sidebar at `>=768px` and a hamburger drawer below it, so
  there are no tabs to shift, and `HeaderHeight` is a *minimum* there rather than a fixed
  height — a narrow window is allowed to wrap the title and its actions.
  CSS `position: sticky` is the collapsing mechanism whenever it is wanted. This
  stays open because none of that closes it on the phone.

- [ ] **No day outlook when plans exist.** `NearbyForecastPreview` renders only
  in the empty state, so having any plan loses the rest-of-day view. Blocked on
  a decision this file can't make: the preview is anchored to the *device*
  location, so with plans on screen "the rest of today" could mean where you are
  or where you are going.

### Add / edit plan form

- [ ] **Duplicate-to-date is misplaced.**
  [CopyToDateAction.tsx](src/components/itinerary/CopyToDateAction.tsx) sits
  between Save and Delete inside a form where nothing else takes effect until
  Save — but it commits immediately. Its *silence* is fixed (it raises a "Copied
  to Sat, 2 Aug" toast); its placement is not. Moving it out is a navigation
  change, and the obvious home — a header action — is the one place iOS 26 wraps
  in Liquid Glass.

  **Diverged on web (round 39).** Liquid Glass is not a constraint in a browser,
  so `apps/web` ships the answer this item wanted: a labelled field and a button
  that acts on it, spaced like every other field
  ([CopyToDateAction.tsx](apps/web/src/components/itinerary/CopyToDateAction.tsx)).
  The phone is unchanged, so this stays open.

- [ ] **Two questions on Save is one more than a form usually asks.** A
  routine's stop raises a scope prompt on Save *and* the unsaved-changes guard
  can raise one on Cancel. They never fire together today, but the form is now
  long enough — Location, Label, Day, Starts, Ends, Repeat, Indoor/outdoor, Rain
  alerts — that it is worth a look alongside the collapsing-header work.

### Settings & notifications

- [ ] **Digest times are three hardcoded chips** (`06:30`/`07:30`/`08:30`,
  [settings.tsx:42](src/app/%28tabs%29/settings.tsx#L42)). Defensible as a
  constraint, but the specific values look arbitrary with no custom option.

- [ ] **A long lead time can be swallowed by quiet hours, silently.** Carried
  over from the lead-time control, which shipped without this last piece. A
  longer lead pushes the trigger *earlier*, which can move it across the
  quiet-hours boundary — an 8am stop at 1 hour's lead fires at 7am, outside the
  default `end: "07:00"` window but inside a 22:00–08:00 one. Alerts in the
  window are suppressed rather than delayed
  ([notifications.ts](src/services/notifications.ts)), so the result is a
  missing notification with nothing said about it. The other two traps of that
  item are handled — `planNotificationResync` compares the scheduled lead
  against the current setting and reschedules, and `SlotForm` warns when a plan
  starts inside the lead window.

### Accessibility

- [ ] **No Dynamic Type support.** Every size in the app is a fixed `fontSize`
  (~50 of them outside tests), and the layout has hard constraints that break
  when text scales: `HeaderHeight`, `DateTimePickerWidth`/`Height`, and the
  card's location-vs-weather flex split. There is also a lot of 11px text (badge
  age, live-conditions labels, section headings) that is small even at default
  scale. This is the largest item left and the one least suited to being done in
  passing — it wants a pass of its own with a device at the largest setting.

### iOS widget

- [ ] **The small-family layout has never been checked on a device.** The
  mid-letter wrap ("Clea / r") is fixed in `homeView`
  ([targets/widget/index.swift](targets/widget/index.swift)) by branching on
  `family` — `.systemSmall` stacks the temperature above the verdict, medium
  keeps the side-by-side `HStack`, and the verdict text carries `lineLimit(1)`.
  It is Swift, so no Jest test covers it and the JS toolchain here cannot render
  it. It still wants a native build looked at across both home families.

### Colour

- [ ] **The five-band UV scale is designed but not built.**
  [describeUv.ts](src/utils/describeUv.ts) models the band as a typed `UvBand`,
  so colour is a pure lookup away, but nothing renders one — the readout in
  `LiveConditionsCard` is text only. If it is built, three things were already
  settled: match WHO's green/yellow/orange/red/violet rather than inventing a
  ramp (it is the scale on NEA's own channels); WHO publishes it in Pantone, not
  hex, so pick values that clear contrast against both themes rather than
  colour-matching a printed chart; and push the `extreme` violet toward magenta
  so it doesn't read as app chrome. Green → red is the colour-vision-unsafe
  axis, so the text label must stay beside the colour — the pattern
  `LiveConditionsCard` already follows.

- [ ] **Consider generating the ramp rather than hand-picking it.** Material 3's
  tonal palettes and Radix's 12-step scales exist to give principled
  pressed/hover/disabled steps from one seed. Worth it once there are more than
  a handful of tokens; overkill before that. Explicitly a "consider".

---

## Standing constraints

True across several files at once, which is why they are here and not in a
comment.

### Colour encodes the verdict, and nothing else

Three states, one of which is no colour at all:

| State | Treatment |
| --- | --- |
| Clear — no umbrella | no tint; neutral like everything else |
| Umbrella — rain | `umbrellaRain` |
| Umbrella — sun (high UV) | `umbrellaSun` |

No condition rainbow. Thunder does not get a fourth hue — it is still "umbrella
— rain", and if it needs to stand out it does so through the icon and the
verdict word. A stop that trips both triggers carries both marks, which is
honest: it needs the umbrella twice over.

Apply it to a small element — the icon, the word, a leading accent bar — never a
whole card background. Tinting a surface makes a list of eight stops unreadable.
`toast.tsx` restates this rule for the success/failure pair; it holds everywhere.

**The two umbrella colours are luminance-matched on purpose**, so neither shouts
over the other. That leaves **hue as the only thing separating them**, which is
why a low-opacity wash of either was never going to work — a 20% wash of the
rain colour measured 1.04:1 from the sun one on a dark card. Anything built on
the pair needs the hue at or near full strength (an outline, a glyph, a word),
not a tint of it. No amount of lightness tuning substitutes.

And do not widen the neutral surface steps to make something stand out:
`backgroundSelected` is *every pressed state in the app*, so a value tuned until
selection was obvious would make every press flash read as a selection.
Selection uses `primary`; pressing uses `backgroundSelected`.

### The verdict word has been designed off the card twice

The app is named after an umbrella, and the one thing a stop card exists to say
is whether you need one. That word has been lost twice — once when the verdict
sentence became a corner pill, and again when the pill became an icon
watermark, at which point the answer reached a sighted reader only as a 4px bar,
a 14%-opacity watermark and an `accessibilityLabel`. Both times the card fell
back to leading with NEA's raw string ("Fair (Day)"), which is the *condition*,
not the decision — and the sun case is worse than neutral, because "Fair" reads
as no-umbrella on a UV 10 stop.

Any redesign of `WeatherBadge` or `ItineraryCard` keeps a short verdict word
visible for a stop that needs an umbrella. `describeUmbrella`'s `shortLabel`
("Rain" / "Sun" / "Rain · sun") is the one vocabulary — the iOS widget renders
the same string, so a second one drifts. A clear stop stays wordless on purpose.

### A native prop the Jest mock drops is a prop that will regress

Three separate bugs shared one cause: the `@expo/ui` `DateTimePicker` stub in
[jest.setup.js](jest.setup.js) rendered `null` and threw its props away, so
`themeVariant` (the picker rendering in the *device's* theme, not the app's) and
`style` (the picker floating up over its own caption, since the SwiftUI host
reports no intrinsic size in either axis) were both invisible to the suite and
both shipped. The mock now forwards them and `SlotForm.test.tsx` asserts them.

The rule that follows: when a prop's only effect is inside a native view, the
mock has to forward it and a test has to assert it, or the prop is untested by
construction. The same applies to anything set on the three picker call sites —
`SlotForm`, `RepeatField`, `CopyToDateAction` — which have each regressed the
same layout independently.

### Permission work is not done when it passes review here

The location permission story has been reopened twice after it looked finished:
once because per-screen `useState` meant a grant reached one tab and not the
other, and once by App Review, which read an "Allow" button sitting in front of
the OS dialog as pressure and the primer's copy as not saying the app works
without location. The mechanism was right both times; the wording and the reach
were not. Round 34 in [NOTES.md](NOTES.md#round-34--the-permission-primer-app-review-rejected-and-the-dead-ends-behind-it)
has the detail, and the copy rules live in `OnboardingPermissionPrimer.tsx` and
`settings.tsx`.

Two things worth knowing before touching
[deviceLocationStore](src/store/deviceLocationStore.ts): the foreground re-read
runs from **every** state, not just the recoverable ones (a *granted* permission
switched off in Settings has to be noticed too, and Android lists an app before
it has asked); and every write carries a generation, because a read already in
flight when the user answers the prompt would otherwise land after the grant and
overwrite it with the stale "denied" it was sent to fetch.
