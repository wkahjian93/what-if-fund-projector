# What-If Fund Projector

**Problem:** a GE investment-linked quotation shows the fund value only at 2% (Scenario X) and 5% (Scenario Y). When a client asks "what if it earns 8%?" or "will it last to 100?", there is no answer on the spot.

**Fix:** upload the MPOS PDF or snap the yearly table. The app rebuilds the quotation's own figures, then shows the fund (cash) value and how long the policy lasts at any return you type.

## How to use it (phone)

1. Open the app and tap **Upload PDF or photos** and choose the MPOS PDF. It is read on the phone, with no internet or AI cost.
   - If you only have paper, tap **Take photo**. A tray opens: snap the plan page (plan, age, sum assured, riders, payment term), the "policy may sustain" lines and the yearly table (Table 1; two photos if needed), up to 10 photos, then **Read with AI**. The first time, sign in with your name and the team code.
2. **Check the figures.** Compare two or three numbers with the quotation. Anything missing or unclear is shown in orange, and **Calculate** stays locked until it is fixed. The app never guesses a missing number.
3. Tap **Calculate**, then pick a return: tap 6% / 8% / 10%, use + and −, or type any number such as 6.5.
4. Read the result:
   - **Lasts to age …** or **Fund runs out after age …**
   - The fund value at key ages (65, highest value), next to GE's 2% and 5%
   - **The return needed to last to the end of cover**
   - A chart and a table by age. Ages marked ≈ come after the last age printed in the quotation.
5. **Can you trust it?** shows how closely the app re-creates GE's own 2% and 5% columns and run-out ages. Green means it matches.

Quotations are kept on this phone only (figures, no client name). Delete one with the bin icon; the app asks first.

## GE rate tables (from the team server)

Agents tap **Sign in** under **GE rate tables** on the home screen with the team code. The app downloads GE's rate tables (GE internal agency material) from the REDEFINE team server and keeps them on the phone, then checks for a newer version each time it opens. The tables are one file (`ge_ilp_knowledge.json`) in the team's private Google Drive folder; only the team code can read it and only the owner code can replace it (home screen → "Owner: upload new tables to the team server"). They are never part of this repository.

With them, every year the quotation does not print uses GE's own rates for that plan, age, gender, smoker status and riders, scaled to the quotation's printed charges. The review screen shows the plan code and riders it found, with a ✓ for each one in the tables.

Checked on the two sample quotations: the tables reproduce every printed charge within 0.06% (SmartProtect You) and 0.42% (Smart Revive Max), and GE's run-out ages come out exactly with no tuning. Waiver riders (e.g. IL PWE) are charged on the value of the premiums still to be waived (about 15× one year's premium at age 26), not on one year's premium.

## How it calculates

- It uses each year's allocated premium and charges from the quotation, deducted monthly.
- **Two kinds of plan.** For "sum assured + fund" plans (e.g. SmartProtect You), charges are the same at 2% and 5%. For "higher of sum assured or fund" plans (e.g. Smart Revive Max), charges are printed per scenario: the app works out the insurance rate per RM at risk, so a bigger fund means lower charges.
- The fund's tax and fund management charge are fitted to GE's own figures. Both quotations gave the same fund charge as the fund fact sheet (0.75% and 1.5%).
- For years the quotation skips, charges are filled in between the printed years and fine-tuned so the app's 2% and 5% values land on GE's.
- **Boosters / loyalty bonuses** credited into the fund (e.g. RM25,000 at 65 and every 10 years) are read from the PDF and added while the policy is in force.
- **After the last printed charges** (when both 2% and 5% have run out, GE prints zeros):
  - The basic insurance rate keeps rising with age. Two GE quotations agree that it rises about 8–9% a year from age 50 to 76; the app uses the plan's own printed pace, or that reference.
  - Riders and fees keep their own printed pace.
  - If the quotation's "policy may sustain … up to age N" lines need faster charges, the app adds just enough to match them.
  - GE's figures only pin charges down to the 5% run-out age. After that the app shows a **range**: the careful answer (the faster pace continues) and the printed-pace answer.
- Your return uses the same basis as GE's 2% / 5% (before tax and fund charge), the same every year. Real returns swing, which usually shortens the policy.
- Premiums are paid as in the quotation. Top-ups and withdrawals are not modelled.

## Test runs (two real MPOS quotations)

| | SmartProtect You, male 26 | Smart Revive Max, male 32 |
|---|---|---|
| Plan type | sum assured + fund, RM333.35 a month for life | higher of sum assured or fund, 5-year premium, RM25k booster |
| App vs GE fund values at 2% and 5% | within 0.07% | within 0.04% |
| Lasts to age at 2% / 5%: GE vs app | 72 / 80 vs **72 / 80** | 61 / 71 vs **61 / 71** |
| Extra charge growth needed to match GE | +7.7% a year after 76 | **none**: the printed 8.9% pace already matches |
| At 6% | lasts to 83–84 | lasts to 76 |
| At 8% | lasts to **91–97** | lasts to 90 (full term) |
| Return needed to last the full term | **8.2–9.5%** (to 100) | **7.7%** (to 90) |
| **With GE rate tables:** at 8% | **lasts to 100** | 90 (full term) |
| **With GE rate tables:** needed for full term | **7.5%** | **7.8%** |

Run `node test/test.js` for the automated checks (50 checks; the rate-table checks run only where `private/ge_ilp_knowledge.json` exists; `test/server-sim.js` runs the real team server code in memory). Run the preview `what-if-fund` on port 5195.

## Files

`docs/` holds the app (GitHub Pages serves it). `engine.js` holds the maths, `parse.js` reads the PDF and the AI reply, `app.js` holds the screens, and `sample.js` holds the sample quotation figures. `samples/` holds the real quotation PDFs, which are not published.

*Internal estimate tool. Not a Great Eastern benefit illustration. Returns are not guaranteed and insurance charges can be revised.*
