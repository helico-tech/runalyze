# Fixtures Manifest

Expected values computed independently on 2026-07-05 via a standalone spike script
(@garmin/fitsdk 21.208.0, plain unweighted means over finite channel values), BEFORE any
adapter code existed. Tests assert these numbers; they were not produced by the code
under test. "avg" = plain mean; all series are 1 Hz with maxDt = 1 s (no gaps) unless
noted.

## Activity.fit (Garmin fit-javascript-sdk test data)

- records: 3601, startTime 2021-07-20T21:11:20.000Z, lastRelT 3600 s, monotonic
- session: sport standUpPaddleboarding, totalElapsedTime 3601
- fileId: manufacturer "development", no garminProduct → device "development"
- developer fields present ("Doughnuts Earned", "Heart Rate") — native HR also present
- channels (n / avg / max): heartRate 3601 / 126.5096 / 254 · power 3601 / 199.764 / 250
  · cadence 3601 / 126.0358 / 254 · distance 3601 / 1800 / 3600 · speed 3601 / 1 (constant)
  · altitude 3601 / 64.1644 · temperature absent

## HrmPluginTestActivity.fit (Garmin fit-javascript-sdk test data)

- records: 310, startTime 2022-08-29T18:31:22.000Z, lastRelT 309 s, monotonic
- session: sport walking, totalElapsedTime 309 · device fr955
- channels: heartRate 310 / 72.8613 / 93 · temperature 310 / 26.3065 / 28
  · speed 310 / 0.0687 · altitude 310 / 1585.2877 · power absent
  · cadence (spm, walking ⇒ 2×(cadence+fractionalCadence)) 310 / 25.4452

## WithGearChangeData.fit (Garmin fit-javascript-sdk test data)

- records: 1979, startTime 2022-06-22T23:08:37.000Z, lastRelT 1978 s, monotonic
- **no sessionMesgs, no sportMesgs** → sport falls back to "unknown", durationS to 1978
- device edge1040 · native power present: 1979 / 120.4987 / 534
- channels: heartRate 1979 / 105.186 / 136 · cadence 1954 samples (sparser than records),
  avg 82.7682 — native rpm kept: no session ⇒ sport "unknown" ⇒ no stride doubling

## user-run-2026-07-05.fit (user's Garmin FR255 + Stryd; PERSONAL DATA — private repo only)

- records: 3602, startTime 2026-07-05T06:45:13.000Z, lastRelT 3601 s, monotonic, maxDt 1
- session: sport running, totalElapsedTime 3600.873, avgHeartRate 159 · device fr255
- **no native power** — power is developer field {fieldName "Power", units "Watts", key 7}
- channels: heartRate 3602 (avg 159.0147) · speed (enhancedSpeed) 3602 / 2.5059
  · power (developer) 3602 / 213.5053, first value 221 · altitude 3602
  · cadence (spm, running ⇒ 2×(cadence+fractionalCadence)) 3602 / 173.2274 / max 179
  · distance 3602 · temperature absent
- hand-computed decoupling over window [0, 3600), halves at 1800 (plain per-half means):
  - Pa:HR — halves 2.4829/154.6639 and 2.5291/163.3567 → **decoupling 3.5606 %**
  - Pw:HR — halves 210.2950/154.6639 and 216.7206/163.3567 → **decoupling 2.4284 %**
  - window [0, 3600) plain avg HR: **159.0103** (n=3600)
- laps: 7 auto (time) + 1 sessionEnd — **0 manual laps**

## user-long-run-2025-04-26.fit (user's FR255 + Stryd; PERSONAL DATA — private repo only)

- records: 10637, startTime 2025-04-26T07:08:42.000Z, session elapsed 10644.774 s
- sport running, device fr255, totalDistance 30016.3 m — long steady run, no gaps (maxDt 10 s)
- no native power — developer-field (Stryd) power
- channels (n / avg): heartRate 10637 / 165.6215 · speed 10637 / 2.8149
  · power 10637 / 301.2128
- laps: 3 **manual** (button-press) — [0, 7511.275], [7511.000, 9911.000], [9911.000, 10511.002] — plus a sessionEnd tail

## user-gap-run-2026-07-02.fit (user's FR255 + Stryd; PERSONAL DATA — private repo only)

- records: 2199, startTime 2026-07-02T17:26:32.000Z, session elapsed 2329.527 s
  (timer 2196.401 — recording was paused)
- sport running, device fr255, totalDistance 5011.08 m
- **one real recording gap: maxDt 133 s** — the real-data fixture for gap-aware stats
- channels (n / avg): heartRate 2188 / 143.787 (11 records lack HR) · speed 2199 / 2.2725
  · power 2199 / 193.6717
- uncovered time over [0, 2329.527) per spec §2.5 rule (computed independently):
  **exactly 133.000 s** for both heartRate and speed channels
- laps: 4 auto (time) + 1 sessionEnd — **0 manual laps**

## activities.zip

- zip of Activity.fit + WithGearChangeData.fit (entries keep those names)

## corrupt.fit / not-a-fit.txt

- corrupt.fit: first 512 bytes of Activity.fit (valid header, fails integrity)
- not-a-fit.txt: plain text (fails isFIT)

## Adding your own fixtures

Drop additional real runs here, extend this manifest with independently computed facts
BEFORE writing tests that use them (decode with a standalone script, record the numbers).
