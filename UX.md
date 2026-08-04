# Brelly UX improvements

A review of the shipped design from a user's perspective, recorded so the work
can be picked up in any order. Each item names the file it lives in.

Nothing here is a bug — `tsc`, `lint` and `test` all pass on this code. These
are places where the app is correct but harder to use than it needs to be.

Status key: `[ ]` open · `[x]` done · `[~]` partially addressed.

**Progress:** all three P0 items are done, along with the PSI removal, the
lead-time setting, the contrast fixes, the drag-to-reorder removal, save
feedback, the dark-theme surfaces, the native pickers' theming — and, in the
latest round, undo on delete, the whole add/edit form, both remaining Plans
items, search, the notification-permission and test-alert gaps, relative times,
now/next emphasis, reduce-motion, the `border` token — and, most recently, the
form's location dropdown and the gap it left behind.

Item descriptions below are left as originally written — they describe the
problem, not the current code, so a `[x]` item's file references point at what
*was* there.

**What is still open, and why it wasn't just picked up:**

- **The collapsing header** (Today). The cheap half of it shipped; the real
  version is a scroll-driven layout change on a header that is deliberately
  *fixed* so the two tabs don't shift content on switch. That constraint has to
  be resolved first, not worked around.
- **No day outlook when plans exist** (Today). Needs a decision the file
  doesn't make: `NearbyForecastPreview` is anchored to the *device* location
  and only renders in the empty state, so with plans on screen the question is
  whether "the rest of today" means where you are or where you're going.
- **Duplicate-to-date's placement** (form). Its silence is fixed; moving it out
  of a form where nothing else commits until Save is a navigation change, and
  the obvious home — a header action — is the one place iOS 26 wraps in Liquid
  Glass (see round 5).
- **Dynamic Type** (accessibility). The largest remaining item and the one
  least suited to being done in passing: every `fontSize` in the app is fixed,
  and the layout has hard constraints (`HeaderHeight`, `DateTimePickerWidth`,
  the picker widths added this round) that break when text scales. It wants a
  pass of its own with a device at the largest setting.
- **Haptics** (accessibility). Needs `expo-haptics` — a native dependency, so a
  rebuild — for what is genuinely polish. Grouping it with the Dynamic Type
  pass costs one rebuild instead of two.
- **Free-text times in Settings.** The file already calls the three fixed chips
  "defensible as a constraint"; nothing has changed to make them less so.
- **Generating the colour ramp.** Explicitly a "consider" — and with `border`
  now carrying a real value in both themes, the hand-picked set is consistent.

---

## P0 — the ones that change what the app is

### [x] 1. The app never answers its own question

`WeatherBadge` renders NEA's raw string ("Passing Showers", "Partly Cloudy
(Day)") alongside a tier label, a temperature range, wind, and a timestamp —
four pieces of metadata and zero interpretation
([WeatherBadge.tsx:66](src/components/weather/WeatherBadge.tsx#L66)). Someone
planning a 3pm walk has to translate meteorology into a decision themselves,
in an app named after an umbrella.

**The verdict has exactly two inputs: rain and UV.** In Singapore an umbrella
is sun kit as much as rain kit, so the question "do I need one?" is answered
by *either* trigger firing. Everything else NEA publishes is context, not
the decision.

| Condition | Verdict |
| --- | --- |
| Rain likely during the stop | Umbrella — rain |
| High UV during the stop | Umbrella — sun |
| Both | Umbrella — rain and sun |
| Neither | You're clear |

**Do:** derive that line per stop from the forecast text already being
pattern-matched in
[WeatherIcon.tsx:20-33](src/components/weather/WeatherIcon.tsx#L20-L33) plus
the UV band from [describeUv.ts](src/utils/describeUv.ts). Make it the
headline of the badge and demote the raw NEA string.

**Sun never notifies. Rain does.** Shade is a preference — a hat, the covered
walkway, or nothing at all are all valid answers, and a person outdoors at
noon already knows it's sunny. Rain is a necessity, it's not visible from
indoors 45 minutes ahead, and being caught in it has a real cost. So:

| | Shown on the card | Sends a notification |
| --- | --- | --- |
| Rain | yes | **yes** |
| High UV | yes | **never** |

This is a hard rule, not a default — there is no "sun alerts" setting to add
to [settings.tsx](src/app/settings.tsx), and UV must not escalate or extend a
rain alert either.

It also resolves the base-rate problem. `describeUv` alerts from UV 8, and its
own comment notes Singapore "sits at 8–11 through the middle of most clear
days" — as a notification trigger that would fire almost daily and train
people to swipe the app away. As a passive colour on a card it costs nothing
and is there when someone looks.

**Say *why* regardless.** "Umbrella — sun" and "Umbrella — rain 3–5pm" are
different instructions, and the reason is what keeps the line informative once
the answer is usually yes.

### [x] 2. Nothing is coloured by condition

Every badge uses `backgroundSelected` and `colors.text` regardless of weather,
so a thunderstorm and a clear sky are visually identical — scanning a day
tells you nothing until you read every card. The palette
([theme.ts:9-26](src/constants/theme.ts#L9-L26)) has six colours and only one
chromatic (`danger`); the only accent, `linkPrimary: #7C6FD0`, is hardcoded
outside the theme and unused
([themedText.tsx:73](src/components/themedText.tsx#L73)).

**Do:** add wet / dry / severe tints to both theme variants, plus a real
accent for primary actions. Move `linkPrimary` into `Colors` so it is
theme-aware.

### [x] 3. Location permission is asked cold, and denial is a dead end

[useNearbyForecast.ts:36](src/hooks/useNearbyForecast.ts#L36) fires
`requestForegroundPermissionsAsync()` inside a mount effect, so the OS dialog
appears before the user knows why. Denial sets `permission: "denied"` and is
silent by design — the whole nearby-forecast feature disappears with no
explanation, no re-prompt and no deep link to iOS Settings. One tap in the
first five seconds permanently removes a feature.

**Do:** show the empty state first with a "Show weather near me" button that
triggers the request, and render a recovery affordance (explanation + link to
system settings) when the status is denied.

---

## Today screen

- [ ] **The header eats 108px and never collapses.** `HeaderHeight = 108` is
  fixed and the 48pt `title` sits above the `ScrollView` — on a small phone
  that is a fifth of the screen spent permanently on the word "Today" and a
  date. A collapsing large title (or the native `Stack` header) buys back a
  whole card. ([theme.ts](src/constants/theme.ts),
  [index.tsx:72-88](src/app/%28tabs%29/index.tsx#L72-L88))

- [x] **Shrink the header.** The cheap version of the item above, taken
  instead of the collapsing title. `title` is now 34/40 (was 48/52) and
  `subtitle` — the empty-state headline on both tabs — is 24/30 (was 32/44), in
  [themedText.tsx:65-79](src/components/themedText.tsx#L65-L79); `HeaderHeight`
  is 80, down from 108 ([theme.ts](src/constants/theme.ts)). The height stays
  fixed on purpose — Today (title + date) and Plans (title only) would
  otherwise shift content when you switch tabs — and 80 clears both that
  stacked pair and the `+ Add` button's 44pt tap target. Roughly a card's worth
  of screen comes back; the collapsing-header item above would buy more, and is
  still open.

- [x] **Past stops look identical to upcoming ones.** `findCurrentOrNextSlot`
  is already computed to anchor live conditions
  ([index.tsx:48](src/app/%28tabs%29/index.tsx#L48)) but the list ignores it.
  Dim finished stops and mark the current/next one — that's the row the app
  was opened for.

  Both halves are resolved, though only one as written. Finished stops are not
  dimmed — they are *gone*, filtered on end time onto
  [Past plans](src/app/past.tsx) (see the Plans-screen item below), so there is
  nothing left to distinguish them from. The current-or-next stop now takes an
  outline in `primary` (`emphasis` on `ItineraryCard`), keyed off the same
  `findCurrentOrNextSlot` the live readings are anchored to — so the outlined
  card and the "Right now" figures always name one place rather than two.

  An outline and not a fill: the card background already carries the pressed
  state and the 4pt accent bar already carries the weather verdict, so a third
  surface colour would be competing with both for the same edge.

- [x] **Times are absolute only.** "02:00 PM – 03:00 PM"
  ([ItineraryCard.tsx:58-68](src/components/itinerary/ItineraryCard.tsx#L58-L68));
  "in 40 min" is the more useful primary, and `formatRelativeTimestamp`
  already exists.

  `formatRelativeTimestamp` turned out to be the wrong tool — it only formats
  the *past* ("12m ago"), which is what the weather badge needed.
  [describeSlotTiming](src/utils/describeSlotTiming.ts) is its forward-looking
  sibling: "Now" while a stop is running, "in 40 min" / "in 3 hr" ahead of it,
  and `null` past a 12-hour horizon, where the clock time says it better and
  the day heading above the card has already said which day.

  Hours round *down*, so a countdown never runs early — the direction that
  can't make anyone late. Nothing ticks: the value is recomputed on render,
  which covers every way back onto the screen, and a per-card timer would wake
  the whole list once a minute to move a number no one is watching.

- [x] **The label is squeezed by the weather.** `locationContainer` is
  `flex: 2` against `weatherContainer`'s `flex: 3`
  ([ItineraryCard.tsx:137-149](src/components/itinerary/ItineraryCard.tsx#L137-L149)),
  so the plan's name — how the user identifies the row — gets 40% and
  truncates at two lines. Identification should beat detail; with item 1's
  verdict inline the badge can shrink.

- [x] **Muted stops are invisible.** `notificationsMuted` is settable per stop
  ([SlotForm.tsx:288](src/components/itinerary/SlotForm.tsx#L288)) but never
  rendered on a card, so finding out which stops will warn you means opening
  each one.

- [x] **Two identical Add buttons.** The header `+ Add` and the empty-state
  `+ Add a plan` share the same `backgroundElement` fill. Neither reads as
  primary, and side by side they read as different actions.

- [ ] **No day outlook when plans exist.** `NearbyForecastPreview` only
  renders in the empty state, so having plans loses the rest-of-day view.

- [x] **The verdict was a sentence in the middle of the card.** "Umbrella —
  rain" set at 17pt bold competed with the plan's own name for the eye, and
  read as prose where the information is a status. It is now a pill in the
  card's top-right corner
  ([VerdictPill.tsx](src/components/weather/VerdictPill.tsx)) — "Rain" / "Sun"
  / "Rain + sun" / "Clear", washed in the verdict's colour so the
  label keeps `text` and its contrast. (The wash was ~20% here and is now 40%
  with a full-strength outline — see *The verdict pills didn't read as
  different colours* under Colour palette.) A column of cards puts every status
  in the same place to scan down. The full sentence survives as the pill's
  `accessibilityLabel`, and `WeatherBadge` now leads with NEA's own wording.

- [x] **Wind was on the stop card.** It is the one forecast reading that
  cannot change the umbrella answer, and it was what pushed the badge's meta
  line into wrapping. Gone from `WeatherBadge`, along with `formatWind`. The
  measured wind on the "Right now" card is untouched.

- [x] **The rain icon was one big drop parked on the canopy** — it read as a
  second icon rather than as weather. `UmbrellaVerdictIcon` now scatters
  several small drops above and past the edges of the umbrella (three at list
  sizes, five above 30px, three when a sun shares the frame).

---

## Destructive actions & gestures

- [x] **Swipe-delete has no confirm and no undo**, while the edit screen's
  delete has an `Alert` ([\[id\].tsx:56](src/app/plan/%5Bid%5D.tsx#L56)). The
  friction is backwards — the gesture you can trigger by accident is the
  unprotected one. An undo snackbar on both paths is faster *and* safer than
  the alert.

  Resolved as written: the `Alert` is gone and both paths delete immediately
  and offer "Undo" on the toast, through one seam
  ([useDeleteSlotWithUndo.ts](src/hooks/useDeleteSlotWithUndo.ts)). A toast
  carrying an action lives ~6s rather than ~3.2s — the reading time is the
  same, what is added is the time to *decide*.

  Two details are load-bearing. The restore keeps the slot's **id**: `addSlot`
  mints a new one, which would make undo produce a lookalike rather than the
  plan the open route and the scheduled alert were pointing at — hence
  `restoreSlot` on the store. And it *clears* `notificationId`, because the
  delete already cancelled that alert; carrying the id back would leave the
  slot looking permanently scheduled to the foreground resync, which reads
  "has an alert, still rainy" and does nothing, so no alert would ever fire
  for it again.

- [x] **Manual order and chronological order conflicted silently.** Today let
  you drag rows anywhere; Plans rendered the same slots in start-time order.
  Nothing reconciled or explained the two, so the same day read differently
  depending on which tab you were looking at.

  Resolved by deleting the manual order rather than reconciling it. An
  itinerary is a timeline — its order is a fact about the day, not a
  preference — so an arrangement that contradicts the clock can only mislead.
  `sortSlotsByStart` ([planSelectors.ts](src/utils/planSelectors.ts)) is now
  the app's only ordering, applied on write *and* at render on both tabs:
  installs that predate this still have a hand-dragged order sitting in MMKV.
  `SortableItineraryList`, `reorder.ts` and the store's `reorderSlots` are
  gone; Today renders `ItineraryCard`s directly.

  This closes the two items that used to sit here as well — the drag handle
  had no `accessibilityActions`, so screen-reader users could not reorder at
  all, and a started drag gave no lift, shadow or haptic. Both were bugs in a
  feature that shouldn't have existed.

---

## Add / edit plan form

- [x] **A picked location looks the same as typed text.** `selectedPlace` is
  required to submit but the field renders identically whether it is set or
  null
  ([SlotForm.tsx:179-188](src/components/itinerary/SlotForm.tsx#L179-L188)).
  Users type "Botanic Gardens", hit Add, and get "Pick a location from the
  list" — a rule they had no way to know. Show the resolved place as a
  confirmed chip with a checkmark and a clear button.

  Done as described: a picked place replaces the input entirely with an
  outlined chip carrying a checkmark and a clear button, and the search field
  only exists while there is still something to search for. The error also says
  *why* now — "Pick one of the suggestions so we know where this is" rather
  than a rule with no reason attached — and it is only shown when there is
  typed text to explain; an empty field gets "Where is this stop?".

- [x] **Errors surface only at the bottom, only on submit.**
  [SlotForm.tsx:295-299](src/components/itinerary/SlotForm.tsx#L295-L299)
  puts one message above the button; with the suggestion list expanded the
  offending field is off-screen. Use inline per-field errors and scroll to the
  first one.

  Both halves are in. Errors are per-field and render under the field they
  belong to, with the input outlined in `danger` so the message points at
  something; each clears the moment its field is satisfied rather than waiting
  for the next submit. The scroll uses offsets collected from each field's
  `onLayout`, and the fields are validated in the order they appear — so the
  first failure is also the topmost one, which is what makes an error under the
  Location field reachable when the suggestion list has pushed it off screen.
  That is exactly when it fires.

- [x] **Label is asked before location and can't be inferred.** Reverse the
  order and prefill the label from the chosen place name — most stops are
  "the place".

  Both, as written. `placeNameOf` takes the part before the first comma —
  "Singapore Botanic Gardens" out of "Singapore Botanic Gardens, Cluny Road,
  Singapore" — since everything after it is the address the Location row is
  already showing. The prefill stops the moment the user types: a label they
  wrote is theirs, and picking another place must not overwrite it.

- [x] **The date is entered twice.** Both `Starts` and `Ends` are
  `mode="datetime"` pickers, and changing the start date doesn't carry the end
  date along — the handler only bumps when end ≤ start
  ([SlotForm.tsx:254-259](src/components/itinerary/SlotForm.tsx#L254-L259)).
  Moving a plan to another day means editing two dates. One date field plus
  two time fields.

  One date and two times, with the arithmetic in
  [slotTimeFields.ts](src/utils/slotTimeFields.ts). Changing the day moves both
  ends and preserves the offset between them, so a stop that ran past midnight
  still does — measured from the date keys, not by dividing the millisecond
  gap, since 23:30–00:30 is a one-hour stop that crosses a day.

  Two smaller decisions came with it. An end time at or before the start is
  read as running past midnight and lands on the next day (with a "Next day"
  note) rather than being rejected — an error on a picker that only offers
  times gives the user no move that satisfies it. And a time capsule is
  narrower than the date+time pair these fields used to render, which is what
  lets two of them sit side by side on a phone at all.

- [x] **No unsaved-changes guard.** Cancel and modal swipe-down both discard
  silently ([new.tsx](src/app/plan/new.tsx),
  [\[id\].tsx](src/app/plan/%5Bid%5D.tsx)).

  The two exits get different treatment, because they are different acts.
  **Cancel** is deliberate, so it asks — but only when something is unsaved; a
  confirmation on an untouched form is friction, and one that always appears is
  one people learn to dismiss without reading. **The swipe-down** is not
  deliberate enough to ask about — it can be a mis-aimed scroll on the first
  field — so it is turned off outright while the form is dirty
  (`setOptions({ gestureEnabled: false })`, which is what UIKit's
  `isModalInPresentation` maps to), leaving the button, which does ask, as the
  only way out. See
  [useUnsavedChangesGuard.ts](src/hooks/useUnsavedChangesGuard.ts).

- [x] **Status messages fight for one slot.** "Searching…", the search error
  and the location error render sequentially at 12pt secondary
  ([SlotForm.tsx:208-217](src/components/itinerary/SlotForm.tsx#L208-L217)),
  shifting layout as they swap, and `error ?? locationError` hides one when
  both are real.

  The Location field now has one status area with a reserved line, so messages
  coming and going don't shift everything below them, and it renders *all* the
  live messages rather than the first — it grows for the rare case where two
  are real, which beats hiding one of two genuine problems.

- [x] **"Use my location" is a sub-44pt target** — 12pt text with a 12px icon
  and no `hitSlop`
  ([SlotForm.tsx:189-207](src/components/itinerary/SlotForm.tsx#L189-L207)).

- [x] **The date/time fields rendered in the device's theme, not the app's.**
  `Starts`, `Ends` and the duplicate-to-date picker are real SwiftUI
  `DatePicker`s, and SwiftUI decides the chip fill and label colour from its
  `colorScheme` environment value — which follows the OS. On the dark theme
  over a light system that gave a translucent light chip carrying *black* label
  text in the middle of a dark form: the date and time were the least readable
  text on the screen, and no `Colors` token was involved, so nothing in the
  palette could have fixed it.

  All three pickers now pass `themeVariant={useAppColorScheme()}` — the prop
  maps to `.environment(\.colorScheme, …)` — plus `accentColor={theme.primary}`
  so the selection tint is the app's violet rather than the system blue.
  ([SlotForm.tsx](src/components/itinerary/SlotForm.tsx),
  [CopyToDateAction.tsx](src/components/itinerary/CopyToDateAction.tsx))

  The Jest stub for the picker used to render `null` and drop every prop, which
  is why this was never covered. It now forwards `themeVariant` on a tagged
  `View` and `SlotForm.test.tsx` asserts both schemes — the prop is invisible
  when dropped, so it needed a guard.

- [x] **The suggestion list was a block in the flow, not a dropdown.** It
  rendered between the Location and Label inputs
  ([SlotForm.tsx](src/components/itinerary/SlotForm.tsx)), so every keystroke
  that changed the number of results moved Label, Day, Starts and Ends down the
  screen — you aimed at a field and hit whatever the list had pushed into its
  place. It also had no way to close: short of picking a result or emptying the
  field, the list stayed.

  The list is now absolutely positioned against the input and hangs over the
  fields below it — a hairline, a shadow, and `elevation` (Android's shadow
  *and* its stacking order) so it reads as floating rather than as part of the
  form. Stacking needs `zIndex` in two places, not one: on the Location field,
  or the Label field below paints over the list, and on the input's own
  wrapper, or "Use my location" — a later sibling *inside* the field — prints
  its text straight through the first result. Focus opens and closes it; the
  suggestions survive the blur, so returning to the field costs no second
  search.

- [x] **Too much air between Location and Label.** Two things held the gap
  open ([SlotForm.tsx](src/components/itinerary/SlotForm.tsx)): a status line
  reserving 16pt whether or not it had anything to say, and a "Use my location"
  row padded to 32pt for a 12pt link. That put ~56pt between the two fields
  where every other pair has ~36.

  The reserved line is gone. "Searching…" — the only message that appears often
  enough to shift anything — moved into the "Use my location" row, which is
  there either way, so the common case costs no height and causes no shift.
  Errors render only when there are errors; they are rare enough that reserving
  against them cost more than the shift is worth. The row itself is 24pt with
  `hitSlop` carrying the target past 44, rather than 32pt of box.

- [~] **Duplicate-to-date is misplaced.**
  [CopyToDateAction.tsx](src/components/itinerary/CopyToDateAction.tsx) sits
  between Save and Delete inside a form where nothing else takes effect until
  Save — but it commits immediately, and gives no confirmation that the copy
  landed. *The silence is fixed: it now raises a "Copied to Sat, 2 Aug" toast
  from the modal's own host. Its placement inside a form where nothing else
  commits until Save is still wrong.*

- [x] **A repeat could only be entered once and then ran out.** The old chips
  (`Once / Daily / Weekdays / Weekly`) wrote a fixed run of stops — "Weekdays"
  meant five, one week, and then nothing. Nothing on the form said the repeat
  would stop, and nothing afterwards said those five stops had ever been one
  thing, so a standing commitment had to be re-entered every week and changing
  it meant editing each day. *Replaced by
  [RepeatField](src/components/itinerary/RepeatField.tsx): pick any days of the
  week and an optional end date, and it is stored as a rule that keeps a
  fortnight filled in ahead of you. The hint under it now names the rule
  ("Repeats Mon–Fri") rather than a count, because a routine has no count.*

- [ ] **A routine is only reachable through one of its days.** Editing or
  deleting any stop asks whether you mean the day or the rule, which is enough
  to change or end a routine — but there is no list of the routines you have,
  and no way back to one whose days were all deleted individually. Tracked in
  `PLAN.md`; it needs a screen, not a change to this form.

- [ ] **Two questions on Save is one more than a form usually asks.** A
  routine's stop raises a scope prompt on Save *and* the unsaved-changes guard
  can raise one on Cancel. They never fire together today, but the form is now
  long enough — Location, Label, Day, Starts, Ends, Repeat, Indoor/outdoor,
  Rain alerts — that this is worth a look alongside the collapsing-header work.

---

## Plans screen

- [x] **You can't add to a specific day.** `/plan/new?date=` is wired up
  ([new.tsx:12](src/app/plan/new.tsx#L12)) but nothing ever passes `date` —
  section headers aren't actionable, so adding to next Saturday means opening
  the form and hand-scrolling a datetime picker.

  Each section header now carries a `+` that passes its own date, so the
  parameter that had been sitting there unused since the form was written
  finally has a caller.

- [x] **The past-plans toggle is at the very bottom of the list**
  ([plans.tsx:144-157](src/app/%28tabs%29/plans.tsx#L144-L157)) — with a month
  of upcoming plans you scroll past everything to reach it. It belongs in the
  header as a filter.

  Resolved by moving past plans off this screen entirely rather than by moving
  the toggle. They live on their own pushed screen,
  [past.tsx](src/app/past.tsx), reached from an archive button in the header —
  and only when there is something in it, so the button never leads nowhere.
  The Plans list is now upcoming-only, with no footer toggle and no
  `showPast` state.

  The split moved with it. `splitPlansByDate` cut on the date key, so every
  stop on today's plan stayed "upcoming" until midnight — the 9–11am stop was
  still at the top of the list at 6pm.
  [splitPlansByTime](src/utils/splitPlansByTime.ts) cuts per *stop*, on end
  time, which means today can appear in both halves: the morning in the
  archive, the evening still ahead. Both tabs and the archive read the two
  halves of one call, so a stop is in exactly one place and the boundary can't
  drift between screens.

  Two knock-ons worth knowing:

  - **Today's empty state now has two meanings**, so it says two things. A day
    whose stops have all finished gets "Nothing left today" and a pointer to
    Past plans; only a genuinely empty day gets "No plans yet". Without that,
    a full day of stops disappearing by evening reads as data loss. The Plans
    tab does the same thing with "Nothing upcoming" vs "Nothing planned".
  - **A past card asks for no forecast.** `ItineraryCard` takes a `past` prop
    that drops the weather query, the badge, the pill and the accent bar — NEA
    publishes forecasts, not history, so an archive would otherwise fire one
    request per card to render a column of "No forecast". It deliberately does
    *not* dim the card: every card there is past, so dimming separates it from
    nothing and only costs contrast.

- [x] **Settings is only reachable from the Plans tab header**
  ([plans.tsx:63](src/app/%28tabs%29/plans.tsx#L63)) — not discoverable from
  Today, where users actually spend their time.

  Today's header carries the same gear button now. It sits beside `+ Add` in a
  neutral fill rather than the primary one, so the two don't read as a pair of
  equal actions.

- [x] **No search or filter** once the list exceeds a screen or two.

  [filterPlans](src/utils/filterPlans.ts) matches every term against label,
  location *and* the derived NEA region — the region because it is the one
  thing about a stop the user never typed, which makes "what have I got in the
  east" answerable without a second control. Terms match in any order and as
  substrings, since half-typed queries are the normal case in a field that
  filters as you type.

  The field ([PlanSearchField](src/components/itinerary/PlanSearchField.tsx))
  appears only past `SearchThreshold` stops — below that, scanning beats
  typing — and then *stays* while a query is live, so narrowing the list to
  nothing can't remove the control that narrowed it. It is shared with
  [Past plans](src/app/past.tsx), which is the list that actually grows without
  bound. A blank query returns the same array reference rather than a copy, so
  an unrelated render doesn't rebuild every `SectionList` section.

---

## Loading, errors & staleness

- [x] **Cards jump on load.** `isLoading` returns a bare `ActivityIndicator`
  ([WeatherBadge.tsx:29-31](src/components/weather/WeatherBadge.tsx#L29-L31))
  a fraction of the badge's height, so every card resizes when data lands. Use
  a skeleton at the badge's real dimensions.

- [x] **Errors are styled like data.** "No forecast" and "Couldn't load
  forecast · Retry" render as 12pt secondary text — the same weight and colour
  as the temperature and wind readings — so a failed card doesn't read as
  failed at a glance.

- [x] **`SOURCE_LABEL` is developer vocabulary.** "Live" / "Today" / "4-day" /
  "Offline"
  ([WeatherBadge.tsx:19-24](src/components/weather/WeatherBadge.tsx#L19-L24))
  describes which NEA API tier answered — an implementation detail. Fold it
  together with the "Updated 12m ago" line into one plain-language freshness
  note.

- [x] **Pull-to-refresh has no screen-level result.** Both tabs refresh, but
  staleness is only shown per badge — nothing confirms the whole screen
  updated.

  `useWeatherRefresh` now raises "Weather updated" or "Couldn't reach the
  weather service" once, for the screen. The verdict comes from the query cache
  *after* the refetch rather than from its return value — `refetchQueries`
  resolves whether or not the requests succeeded. It stays silent when no
  weather query was mounted at all, which is the empty state pulling: "Weather
  updated" there would be a claim about nothing.

- [x] **Nothing confirmed that a change was saved — or that it wasn't.** Every
  mutation in the app was fire-and-forget. Settings has no Save button and
  never closes, so flipping a switch produced no acknowledgement at all;
  adding, editing and deleting a plan dismissed the modal, which reads as
  success whether or not anything was written. And a failed MMKV write threw
  out of `set(...)` — zustand's `persist` calls `setItem` synchronously and
  doesn't catch — so the failure case wasn't silent, it took the screen down.

  Both now go through `saveWithFeedback`
  ([saveWithFeedback.ts](src/utils/saveWithFeedback.ts)), which runs the
  mutation, raises a success or error toast, and hands back the result so a
  caller can skip navigating away when the save didn't happen — the add and
  edit forms stay open on failure rather than dismissing and dropping what was
  typed. Messages say what changed in the user's words ("Rain alerts off",
  "Deleted Morning run", "Copied to Sat, 2 Aug"), not "Saved".

  The toast itself is `ToastHost` ([toast.tsx](src/components/toast.tsx)) over
  a small store. One subtlety worth knowing: `plan/new`, `plan/[id]` and
  `settings` are `presentation: "modal"`, which on iOS is a real view
  controller presented over the window — a host at the root is *behind* it, so
  each modal mounts its own and takes over while open. Because the toast lives
  in the store rather than the host, one raised just before `router.back()`
  survives the modal that raised it and finishes on the tab underneath.

- [x] **Success and failure didn't read as opposites.** A failure filled the
  toast with `danger`; a success got `backgroundSelected` — the same violet as
  an inert selected chip, and in the light theme the very same value as
  `border` — with `primary` for the glyph. So one variant shouted and the
  other had no status colour at all.

  Both now carry their own hue on the glyph and the outline, from a new
  `success` token luminance-matched to `danger`, over a neutral
  `backgroundElement` surface. Filling the toast with the status colour was
  tried first and rejected as too loud for a confirmation that fires on every
  settings toggle — it also broke this file's own rule about putting colour on
  a small element rather than a whole background.
  [toast.tsx](src/components/toast.tsx) resolves the accent through one
  variant → token map rather than an `isError` ternary at four call sites.

---

## Settings & notifications

- [x] **Toggling "Rain alerts" on with OS permission denied does nothing,
  silently.** [settings.tsx:81-85](src/app/settings.tsx#L81-L85) never checks
  or surfaces notification permission state.

  [useNotificationPermission](src/hooks/useNotificationPermission.ts) reads it
  and Settings says so above the switches. The distinction that matters is
  `canAskAgain`: "not asked yet" still has a prompt and gets an inline "Allow
  notifications" button, while "asked and refused" has none and gets a link to
  system settings. Offering a button that silently does nothing is precisely
  the failure this item is about, so the two must not share one affordance.

  Re-read on every return to the foreground, because the only way back from a
  refusal is the Settings app — the answer changes while we are backgrounded
  and nothing else would tell us. A read that *fails* leaves the status alone
  rather than falling back to "denied": an accusatory banner in front of
  someone whose permission is fine is its own bug.

- [x] **No way to verify alerts work** — no test notification, no list of
  what's currently scheduled, no threshold control. Users can't build trust in
  a feature whose entire value is firing at the right moment.

  Two of the three, and the third (the threshold) shipped earlier as the
  lead-time control below. Settings now shows how many alerts the OS *actually*
  has queued — which differs from "Rain alerts: on" for good reasons (nothing
  upcoming looks wet, everything is muted, the lead time has passed on the near
  ones) and the gap is invisible without a number — and sends a test alert.

  The test fires five seconds out rather than immediately: a notification
  delivered while the app is in the foreground may present no banner at all, so
  an alert that works perfectly would look broken. It reports failure rather
  than claiming a send when permission isn't granted.

- [x] **Rain alert lead time should be user-selectable.** 45 minutes is
  currently a constant
  ([computeNotificationTriggerTime.ts:1](src/utils/computeNotificationTriggerTime.ts#L1))
  and hardcoded into the settings copy
  ([settings.tsx:78](src/app/settings.tsx#L78)). How much warning someone
  needs is personal — it's the walk to the MRT versus a drive across the
  island. Offer four intervals:

  **15 min · 30 min · 45 min · 1 hour**, defaulting to 45 so existing
  installs don't change behaviour.

  Most of the plumbing exists. `leadMinutes` is already an optional parameter
  on both `computeNotificationTriggerTime` and `ScheduleRainOptions`
  ([notifications.ts:49](src/services/notifications.ts#L49)) — it is simply
  never supplied, so the default constant always wins. The work is:

  - add `rainLeadMinutes: number` to
    [settingsStore.ts](src/store/settingsStore.ts) (defaults merge over
    persisted state, so no migration — see the comment there)
  - render a fourth `ChoiceRow` under the Rain alerts switch, and make the
    "45 minutes before a stop that looks wet" hint read the setting
  - pass it through
    [useRainNotificationScheduler.ts:31-33](src/hooks/useRainNotificationScheduler.ts#L31-L33),
    which already reads `quietHours` from the store and just needs the second
    value

  Three things to get right, none of them obvious:

  1. **Changing the setting must reschedule what's already scheduled.** Every
     existing alert was scheduled against the old lead time and will still
     fire at it. Worse, the foreground resync won't correct it:
     [planNotificationResync](src/utils/planNotificationResync.ts) decides
     purely on "does this slot have an alert" and "is the forecast still
     rainy", so a slot that already has an alert produces no action no matter
     what the lead time is now. Either teach the resync to compare the
     scheduled trigger against the current setting, or cancel-and-reschedule
     everything on change. Without this the setting silently only applies to
     plans created after it.
  2. **A longer lead means fewer alerts on near-term plans, silently.**
     `computeNotificationTriggerTime` returns null when the trigger has
     already passed, so a plan starting in 40 minutes gets an alert at 15 or
     30 minutes' lead and *nothing* at 45 or 1 hour. That's correct behaviour
     but invisible — the form should say so when adding a plan inside the
     lead window ("starts too soon to warn you").
  3. **It interacts with quiet hours.** A longer lead can push a trigger back
     across the quiet-hours boundary — an 8am stop at 1 hour's lead fires at
     7am, which the default `end: "07:00"` window no longer covers but a
     22:00–08:00 window would. Alerts are suppressed rather than delayed
     ([notifications.ts:73-81](src/services/notifications.ts#L73-L81)), so the
     result is a missing notification with no explanation.

- [ ] **Times are three hardcoded chips each** (`06:30`/`07:30`/`08:30` at
  [settings.tsx:21-23](src/app/settings.tsx#L21-L23)). Defensible as a
  constraint, but the specific values look arbitrary with no custom option.

---

## Accessibility

Contrast figures below are computed from the hex values in
[theme.ts](src/constants/theme.ts), not estimated.

- [x] **Light-mode secondary text fails WCAG AA.** `textSecondary #7A7591` on
  `background #F8F6FB` is **4.10:1**, and on `backgroundElement #ECE7F5` it is
  **3.63:1** — both under the 4.5:1 minimum for normal text, and it is used
  for nearly every timestamp, hint and label in the app. Dark mode is fine
  (`#A79FBF` on `#2B2638` is 5.81:1). Darkening light `textSecondary` to
  around `#605B78` clears it.

- [x] **White on `danger` fails too.** `#ffffff` on `#E0645C` is **3.42:1**,
  used for the swipe "Delete" label
  ([ItineraryCard.tsx:163-166](src/components/itinerary/ItineraryCard.tsx#L163-L166)).

- [ ] **No Dynamic Type support.** Every size is a fixed `fontSize`, and the
  layout has hard constraints that break when text scales — `HeaderHeight: 108`,
  the 32px drag handle, `DateTimePickerWidth`, and the `flex: 2`/`flex: 3` card
  split. There is also a lot of 11px text (badge age, live-conditions labels,
  section headings) that is small even at default scale.

- [x] **Radio groups lack a container role.** Options in
  [settings.tsx:55](src/app/settings.tsx#L55) and `ChoiceRow` correctly use
  `accessibilityRole="radio"`, but no parent declares `radiogroup`, so
  assistive tech announces them as unrelated buttons.

- [ ] **No haptics anywhere** — not on delete, reorder, save, or toggle.

- [x] **Reduce-motion isn't respected** for the splash overlay
  ([animatedIcon.tsx](src/components/animatedIcon.tsx)) or the
  `LinearTransition` reorder animation.

  [useReduceMotion](src/hooks/useReduceMotion.ts) reads the system setting and
  follows it while the app runs — it can be toggled from Control Centre without
  a restart. The splash keeps a plain cross-fade instead of the elastic scale
  (leaving the screen abruptly is its own jolt, so it fades rather than cuts),
  and the toast appears outright. It defaults to *animating* while the first
  read is in flight, so a device that doesn't care never flickers into the
  animation on the first frame.

  The reorder animation is gone with drag-to-reorder itself — see the
  destructive-actions section.

---

## Colour palette

Expands on P0 item 2. All ratios below are computed from the hex values in
[theme.ts](src/constants/theme.ts).

### What we already have, and it's worth keeping

Measured in HSL, every neutral in both themes sits between **250° and 261°** —
a violet family, held consistently:

| Token | Light | Hue | Dark | Hue |
| --- | --- | --- | --- | --- |
| `background` | `#F8F6FB` | ~260° | `#120F1A` | 256° |
| `backgroundElement` | `#ECE7F5` | 261° | `#332C44` | 258° |
| `backgroundSelected` | `#DCD3EE` | 260° | `#443A59` | 259° |
| `text` | `#332F44` | 251° | `#F3F1F8` | ~255° |
| `textSecondary` | `#7A7591` | 251° | `#B0A8C8` | 255° |

(The dark values are the retuned ones — see *The dark surfaces were stacked too
close to separate* below. The light `textSecondary` here is the pre-fix value
the section was written against; it is `#5A5570` now.)

That is a deliberate identity and an unusual one — most weather apps default to
literal sky-blue. Don't throw it away. Every suggestion below keeps the violet
ground and adds roles around it.

### The actual problem: there are no roles, only surfaces

`Colors` has six flat values and no notion of *purpose*. Concretely, an
inert card and a primary button are the same colour (`backgroundElement`),
which is why `+ Add` doesn't read as the main action anywhere. There is no
`primary`, no `border` (so `NearbyForecastPreview` fakes a divider out of
`backgroundSelected`), no `success` (added since — see below), no `warning`,
and `#ffffff` is hardcoded for text on `danger`.

This is cheap to fix here: `ThemeColor` is derived as
`keyof typeof Colors.light`, so any key added to both variants immediately
becomes valid for `<ThemedText themeColor>` and `<ThemedView type>` with no
other changes.

### Recommended direction: monochrome accent, two-colour weather signal

Two ideas were considered for the accent:

- **A near-complementary amber** (~45°) — maximum separation from the violet
  ground, and "sun" is on-brief. Rejected: amber is also the natural choice
  for the severe-weather signal below, and an accent that collides with a
  content colour makes both meaningless.
- **A saturated version of the existing violet** (~251°) — recommended.
  Because the accent stays in the neutral family, all the chroma budget is
  left for the weather itself, which is the content. Actions read as "the
  app"; weather reads as "the world".

For the weather signal, avoid a full condition rainbow. Colour should encode
the *verdict* from P0 item 1 and nothing else — which means exactly three
states, one of which is no colour at all:

| State | Treatment |
| --- | --- |
| Clear — no umbrella | no tint; neutral like everything else |
| Umbrella — rain | blue |
| Umbrella — sun (high UV) | amber |

This falls out well. The two triggers are literally rain and sun, so blue and
amber are the obvious readings rather than an arbitrary code — and
**blue vs. amber is also the colour-vision-safe axis.** Red/green, the
intuitive choice for good/bad, is exactly the pair ~8% of men cannot separate;
blue/amber stays legible under protanopia and deuteranopia and is the
highest-contrast pair in dim light. A stop that trips both triggers can carry
both marks, which is honest — it needs the umbrella twice over.

Thunder doesn't get its own colour. It is still "umbrella — rain"; if it
needs to stand out it should do so through the icon and the verdict text,
not a fourth hue.

Apply it to a small element — the weather icon, or a leading 3px bar on the
card — never the whole card background. Tinting a whole surface makes a list
of eight stops unreadable and fights the item-1 verdict text.

### Concrete starting values

Verified against WCAG AA; treat as a starting point, not gospel.

```
                        light      dark
background              #F8F6FB    #120F1A   (dark deepened — see below)
backgroundElement       #ECE7F5    #332C44   (dark lifted — see below)
backgroundSelected      #DCD3EE    #443A59   (dark lifted — see below)
textSecondary           #5A5570    #B0A8C8
danger                  #C4453D    #E8938D   (dark unchanged)
onDanger                #FFFFFF    #120F1A
success                 #198057    #4CBD90   (accent only, no fill)
primary                 #5B44C4    #B9A8F5
onPrimary               #FFFFFF    #120F1A
border                  #DCD3EE    #54496E   (light still an alias)
umbrellaRain            #2E6FB5    #7FB3E8
umbrellaSun             #B2650A    #F0B45C
```

Why these:

- **`textSecondary` → `#5A5570`** fixes the AA failure in the accessibility
  section. It scores 5.84:1 on `backgroundElement` and 4.91:1 on
  `backgroundSelected` (was 3.63:1 and worse). Hue is 251° — same family, so
  nothing looks different apart from being readable.
- **`danger` → `#C4453D`** takes white-on-danger from 3.42:1 to **4.92:1**,
  and still passes as red text on the light background (4.58:1) — one value
  covers both roles.
- **`success` is luminance-matched to `danger`**, so the confirmation and the
  failure carry the same weight: 4.92:1 under white and 4.59:1 as green text
  on the background, the same two ratios `danger` scores. It ships as an
  accent only — glyph and outline, 4.06:1 on `backgroundElement`, against the
  3:1 graphical threshold — so there is no `onSuccess` to go with it. Anything
  that later fills a surface with it needs white here and `background` in
  dark, where white is 2.34:1: the trap `onDanger` already exists for.
  Green/red is the colour-vision-unsafe axis, and this is the one place it's
  acceptable: only one toast is ever on screen, so the two never have to be
  separated side by side, and the glyph and the message both carry the meaning
  without the hue. Data keeps using the umbrella pair.
- **`onDanger` is a real token, not always white.** White on the *dark*
  theme's `#E8938D` is **2.34:1** — worse than the light-mode failure already
  logged. Dark text on it is 7.11:1. The hardcoded `#ffffff` in
  [ItineraryCard.tsx:164](src/components/itinerary/ItineraryCard.tsx#L164) is
  wrong in both themes, for opposite reasons.
- **`primary #5B44C4`** is hue 250.8° — the app's own hue at high saturation.
  White on it is 6.84:1. The dark variant `#B9A8F5` (253°) is 7.91:1 on the
  dark background.
- **Weather colours are for icons and bars, so the bar is 3:1** (WCAG's
  non-text graphical-object threshold), not 4.5:1. `#2E6FB5` clears it
  comfortably on every light surface. If they ever tint *text*, re-check
  against 4.5:1 first.

### UV: use the official scale, but never colour alone

[describeUv.ts](src/utils/describeUv.ts) already models the scale as a typed
`UvBand`, so colour is a pure lookup away. WHO's palette is green / yellow /
orange / red / violet for Low / Moderate / High / Very High / Extreme —
matching the boundaries `describeUv` already encodes. Worth matching rather
than inventing, since it's the scale on NEA's own channels.

Two caveats found while looking it up:

1. **It isn't published as hex.** WHO specifies the palette in Pantone, so
   anything used here is an approximation — pick values that clear contrast
   against both themes rather than colour-matching a printed chart.
2. **The scale runs green → red**, the colour-vision-unsafe axis, and this
   palette specifically has drawn peer-reviewed criticism on that point. Keep
   the text label alongside the colour. `LiveConditionsCard` already does this
   — it renders `describeUv(uv).label` next to the number — and the pattern
   should hold anywhere the band gets colour.

Note the `extreme` band is violet, which is the app's own neutral hue. Push it
toward magenta so it doesn't read as chrome.

**Don't confuse the two UV treatments.** The five-band WHO scale is for the
*readout* in `LiveConditionsCard` ("UV 9 — Very high"). The verdict colour on
a stop card is binary: `umbrellaSun` or nothing. Running a five-colour ramp
across itinerary cards would undo the whole point of the three-state scheme
above.

### [x] Drop PSI

PSI answers "should I wear a mask", not "should I bring an umbrella" — it's
the one reading in the app that doesn't feed the verdict. Cutting it removes a
column from the live-conditions row and a whole NEA endpoint.

It comes out cleanly. PSI is a readout and nothing more — no notification, no
verdict, no other consumer:

- [describePsi.ts](src/utils/describePsi.ts) + its test — delete
- `fetchPsi` / `normalizePsi` in
  [airQuality.ts](src/services/airQuality.ts) + tests — delete
- `PsiReading` in [types/weather.ts:126](src/types/weather.ts#L126) — delete
- the `psi` field of `AirQuality` and its `Promise.allSettled` branch in
  [useAirQuality.ts](src/hooks/useAirQuality.ts) — delete
- the PSI reading in
  [LiveConditionsCard.tsx:104-109](src/components/weather/LiveConditionsCard.tsx#L104-L109)
  + `buildReadings` tests — delete

Two things this shakes loose:

- **`useAirQuality` stops needing a region.** It's currently keyed by region
  and gated on `enabled && region !== null` — but that constraint exists
  *only* because PSI is per-region. `fetchUvIndex()` takes no region at all;
  UV is island-wide. So today, a user with no plans and no location permission
  gets no UV reading despite it being available to anyone. Dropping PSI makes
  the hook region-free and the UV readout unconditional. Worth renaming it
  `useUvIndex` at the same time.
- **`shouldNotifyForHaze` and `shouldNotifyForUv` are both dead, and both
  should stay dead.** Neither is called outside its own test
  ([describePsi.ts:48](src/utils/describePsi.ts#L48),
  [describeUv.ts:39](src/utils/describeUv.ts#L39)). The haze one goes with
  PSI. The UV one goes because sun never notifies — and with it
  `UvDescription.shouldAlert`
  ([describeUv.ts:6-8](src/utils/describeUv.ts#L6-L8)), which exists only to
  feed it. `describeUv` keeps `band` and `label`, which is all the display
  needs.

### [x] The dark surfaces were stacked too close to separate

`background #201C2B` against `backgroundElement #2B2638` was **1.14:1**. That
is not a step anyone can see, so a stop card had no edge: a day's plans read as
one flat sheet with text floating on it, and the pressed state was invisible on
top of that. The light theme has the same 1.13:1 spacing, but light surfaces
carry an edge at a ratio dark ones don't — the complaint was only ever about
dark, and only dark moved.

Fixed by spreading the ramp rather than nudging one value: the background drops
to 8% lightness and the card lifts to 22%, which is **1.43:1**. Dropping the
background is what does most of the work — lifting the card alone runs into the
text on top of it.

Contrast is bounded on both sides here, which is why 22/29% and not more:

- push the card lighter and `textSecondary` on top of it falls. `#A79FBF` was
  already 4.19:1 on the new `backgroundSelected` — under AA — so it lifted to
  `#B0A8C8` (8.37:1 / 5.86:1 / 4.65:1 on background / card / pressed).
- push it past ~24% and the pressed state has nowhere left to go above it
  without taking that same secondary text under AA.

Every neutral stays inside the 250–261° violet family the palette is built on
(255–259°). Knock-ons, all verified: `onDanger` and `onPrimary` follow the
background to `#120F1A` (8.11:1 and 9.00:1, both improved); `border` stops
being an alias for `backgroundSelected` — a divider the same value as the
pressed state is invisible — and becomes `#54496E`, 1.61:1 on a card; the
`VerdictPill` wash lands at 7.7:1 rather than the 8:1 its comment claimed; and
the splash screen's dark `backgroundColor` in [app.json](app.json) follows, or
the launch would flash the old lighter violet.

### [x] The verdict pills didn't read as different colours

The pill was washed in its umbrella colour at **20%**, which was too weak to
tell three answers apart — worst in dark, where the whole range is compressed.
Measured against the dark card, the rain pill was **1.16:1** from the neutral
clear pill and **1.04:1** from the sun pill.

The cause is a consequence of a decision made higher up this file, and worth
recording because it constrains anything else built on the umbrella pair:
`umbrellaRain` and `umbrellaSun` are *luminance-matched* on purpose, so neither
shouts over the other. That leaves **hue as the only thing separating them** —
and a 20% wash puts only a fifth of that hue on screen. No amount of tuning
lightness could have fixed it; the fix had to add hue.

Two changes, in [VerdictPill.tsx](src/components/weather/VerdictPill.tsx):

- **The wash goes to 40%.** That is the ceiling, not a preference: the label
  keeps `text` rather than switching to white, and 40% leaves it at 5.45:1
  (rain) and 4.99:1 (sun) in dark, where 50% would take sun to 4.03:1 — under
  AA. Rain-vs-clear goes from 1.16:1 to 1.72:1.
- **A 1pt outline in the same colour at full strength.** This does most of the
  work. A wash spreads colour thinly across a 60×20pt tag; an undiluted line
  reads as the hue itself. It clears the 3:1 graphical threshold on the card in
  both themes — 6.01:1 / 7.19:1 dark, 4.27:1 / 3.64:1 light. A full point and
  not `hairlineWidth`: 0.33pt on a 3x screen is not enough line to read a
  colour off.

A clear stop takes the neutral `border` for its outline — the first thing in
the app to render that token — so it is *quieter* than the two verdicts that
want something from you rather than differently loud. Every pill keeps the same
shape; only the strength of the hue changes.

### Related open items

- [x] Move `linkPrimary: #7C6FD0` out of
  [themedText.tsx:73](src/components/themedText.tsx#L73) and into `Colors` as
  `primary`. It is currently hardcoded, identical in both themes, unused, and
  marginal for contrast either way (~3.8:1).
- [x] Replace the fake divider in
  [NearbyForecastPreview.tsx](src/components/weather/NearbyForecastPreview.tsx)
  with the `border` token. The token now carries a real hairline value in dark
  (`#54496E`) rather than aliasing `backgroundSelected`, and `VerdictPill`
  renders it on a clear stop — but light is still an alias and wants its own
  value before anything leans on it harder.

  Light got its own value first, since the divider would have been invisible
  otherwise: as an alias, `border` measured **1.19:1** on a card — the same
  can't-see-it problem the dark surfaces had. `#BBB4CF` is **1.64:1** on
  `backgroundElement` and **1.86:1** on `background`, which matches the 1.61:1
  the dark `border` scores on its own card, so a divider carries the same
  weight in either theme. Hue 255.6°, inside the 250–261° family.
- [ ] Consider generating the ramp rather than hand-picking it. Both Material
  3's tonal palettes and Radix's 12-step scales exist to give principled
  pressed/hover/disabled steps from one seed — worth it once there are more
  than a handful of tokens, overkill before that.

---

## Suggested order

Written before any of the above was done, and left as a record of the
reasoning. Steps 1–4 are complete; step 5 is the open list at the top of this
file.

1. **Drop PSI first.** It's subtraction, it's isolated, and it makes
   `useAirQuality` region-free — which items 1 and 3 both benefit from.
2. **Items 1 and 2 together** — the umbrella verdict plus its colour is the
   highest return for the effort, and they are the same feature: rain and UV
   in, one line and one tint out.
3. **The light-mode contrast fixes** — two hex values, app-wide effect.
4. **P0 item 3 and the permission recovery path** — currently loses a whole
   feature on a single tap.
5. Everything else, by screen.
