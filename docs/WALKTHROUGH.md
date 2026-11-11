# Contextual form walkthrough

Choose **Bantu isi** on any of the simulator's four steps. A non-modal guide highlights the relevant field or group, explains its purpose and limits, and offers **Berikutnya**, **Sebelumnya**, **Ke bagian yang disorot**, and **Tutup**. Fields remain editable while the guide is open.

- The guide starts on the current simulator step. At the end of a stage it uses the form's normal validation before moving to the next stage. At the end of Biaya, **Selesai** closes the guide; calculating still requires **Hitung simulasiku**.
- Changing the consumption method, monthly coverage, geography opt-in or other controls refreshes the guide to match the visible inputs. A form rerender retains the current guide item and, when identifiable, the focused input.
- A blocked stage receives a highlighted validation-summary step. The guide does not invent values, accept extrapolation, turn on a map, enable geographic correction or choose local storage for the user.
- Optional map, coordinates, building heading, geographic production correction and hourly CSV are explained explicitly. Without those extras, the basic simulation remains available. With geographic correction, monthly yield must be a horizontal reference rather than already roof-corrected output. Imported hourly AC production must not receive the same orientation correction again.
- The guide is not modal: there is no focus trap or background blocker. Standard Tab/Shift+Tab and Enter/Space work, and Escape closes the guide. **Ke bagian yang disorot** moves focus to an available control without activating it. Guide descriptions are associated with the highlighted controls and existing descriptions are preserved.
- Animations run once when the guide or highlight changes. Reduced-motion preferences disable animation and smooth scrolling. The guide is hidden in print output.
- On narrow screens, the guide uses a bottom card. Scrolling keeps the target above the card; visual-viewport changes limit card height to leave room for editing with an onscreen keyboard. The page reserves scroll space at the bottom while the guide is open.
- Details sections needed by a guide step open temporarily. They return to their previous closed state unless the user explicitly interacted with their summary.
- Closing, rerendering or leaving the simulator removes highlights, temporary description IDs, event handlers and the guide card. Walkthrough state is in memory only and is not added to saved input or JSON snapshots.

## Verification

`node --test tests/form-helper.test.js` covers branching content; launch/close/reopen; input values and description preservation; keyboard behavior; focus and stage transitions; normal submit validation; final-step non-submission; route disposal; temporary details; error recovery; reduced-motion scrolling; small-screen placement; and visual-keyboard layout calculations. The tests use a small synthetic DOM boundary, not a browser engine.

The full existing suite and `npm run check` should be rerun after integration changes. No end-to-end browser, screen-reader or actual-phone acceptance claim is made: Chromium in the current executor fails before loading a page because its process-singleton socket is denied. Real-browser verification remains required, especially touch/keyboard scrolling, card overlap at high zoom, contrast/focus appearance, assistive-technology announcements and interactive-map behavior.
