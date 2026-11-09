# What-If Fund Projector

**Problem:** a GE investment-linked quotation shows the fund value only at 2% (Scenario X) and 5% (Scenario Y). When a client asks "what if it earns 8%?" or "will it last to 100?", there is no answer on the spot.

**Fix:** upload the MPOS PDF or snap the yearly table. The app rebuilds the quotation's own figures, then shows the fund (cash) value and how long the policy lasts at any return you type.

## How to use it (phone)

1. Open the app and tap **Upload PDF or photos** and choose the MPOS PDF. It is read on the phone, with no internet or AI cost.
   - If you only have paper, tap **Take photo** and snap **Table 1** (the yearly table with Scenario X / Scenario Y). Add page 2 ("the policy may sustain for … up to your age …") if you can. The first time, sign in with your name and the Form Filler team code.
2. **Check the figures.** Compare two or three numbers with the quotation. Anything missing or unclear is shown in orange, and **Calculate** stays locked until it is fixed. The app never guesses a missing number.
3. Tap **Calculate**, then pick a return: tap 6% / 8% / 10%, use + and −, or type any number such as 6.5.
4. Read the result:
   - **Lasts to age …** or **Fund runs out after age …**
   - The fund value at key ages (65, highest value), next to GE's 2% and 5%
   - **The return needed to last to the end of cover**
   - A chart and a table by age. Ages marked ≈ come after the last age printed in the quotation.
5. **Can you trust it?** shows how closely the app re-creates GE's own 2% and 5% columns and run-out ages. Green means it matches.

Quotations are kept on this phone only (figures, no client name). Delete one with the bin icon; the app asks first.

## How it calculates

- It uses each year's allocated premium and charges from the quotation, deducted monthly.
- The fund's tax and fund management charge are fitted to GE's own figures.
- For years the quotation skips, charges are filled in between the printed years. They are fine-tuned so the app's 2% and 5% values land on GE's.
- After the last printed age, charges keep rising. The rate is tuned so the app's run-out ages match the quotation's "policy may sustain" lines.
- Your return uses the same basis as GE's 2% / 5% (before tax and fund charge). It is assumed to be the same every year; real returns swing, which usually shortens the policy.
- Premiums are assumed paid in full every year. Top-ups and withdrawals are not modelled.

## Test run (real MPOS quotation, SmartProtect You, male 26, RM333.35 a month)

| | GE quotation | This app |
|---|---|---|
| Fund value at 2%, years 1–40 | printed | within 0.07% at every printed year |
| Fund value at 5%, years 1–50 | printed | within 0.07% at every printed year |
| Lasts to age at 2% | 72 | 72 |
| Lasts to age at 5% | 80 | 80 |
| **Lasts to age at 8%** | not shown | **91** (fund RM287,179 at age 65) |
| **Return needed to last to 100** | not shown | **about 9.5%** |

Run `node test/test.js` for the automated checks (16 checks). Run the preview `what-if-fund` on port 5195.

## Files

`docs/` holds the app (GitHub Pages serves it). `engine.js` holds the maths, `parse.js` reads the PDF and the AI reply, `app.js` holds the screens, and `sample.js` holds the sample quotation figures. `samples/` holds the real quotation PDFs, which are not published.

*Internal estimate tool. Not a Great Eastern benefit illustration. Returns are not guaranteed and insurance charges can be revised.*
