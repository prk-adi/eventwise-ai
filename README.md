# EventWise AI — GenAI Event Planning Assistant

EventWise AI helps people plan **weddings, birthdays, and community events** by generating a practical starting plan: budget allocation, timeline, vendor checklist, personalized ideas, and planning advice.

## Challenge alignment

**Chosen vertical:** GenAI-powered event planning assistant.

The application adapts its plan to event type, budget, guest count, date, style, location, and special requests. It aims to make event planning more organized and accessible, while clearly distinguishing estimates from verified facts.

## Features

- Event-specific planning for weddings, birthdays, and community events.
- Budget allocation with a contingency reserve and a visual breakdown.
- Automatic indicative budget estimates from event type, guest count, currency, and (for INR) recognized Indian city tiers.
- Timeline tasks, with dates when an event date is supplied.
- Future-date validation with suggested task deadlines distributed up to the event date.
- Editable, reorderable timeline and vendor checklist with completion tracking.
- Overall planning progress and per-category actual-cost tracking against the budget.
- Personalized themes and ideas.
- Planning Q&A assistant.
- Downloadable JSON plan, budget CSV export, and print / Save as PDF.
- Multiple plans and checklist progress are saved locally in the browser and restored after refresh.
- Gemini API integration is optional; a local rule-based fallback works without an API key.
- Input validation, safe output rendering, error handling, and automated tests.

## Tech stack

- Python 3 and Flask
- HTML, CSS, vanilla JavaScript
- Gemini API (optional)
- JSON sample logic and browser local storage
- Python `unittest`

## Run locally

1. Install Python 3.10 or newer.
2. Clone this repository and enter the project folder.
3. Create and activate a virtual environment:

   **Windows**
   ```powershell
   py -m venv .venv
   .venv\Scripts\Activate.ps1
   ```

   **macOS / Linux**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Optional: configure Gemini by setting `GEMINI_API_KEY` in your shell. The app does not load `.env` files automatically; `.env.example` is only a reference. Never put a real key in a committed file.

   **PowerShell**
   ```powershell
   $env:GEMINI_API_KEY="YOUR_KEY_HERE"
   ```

   **macOS / Linux**
   ```bash
   export GEMINI_API_KEY="YOUR_KEY_HERE"
   ```

   Keep the variable set in the same terminal session used to start the app. Restart the app after changing it.

6. Start the app:
   ```bash
   python app.py
   ```
7. Open `http://127.0.0.1:5000`.

Without `GEMINI_API_KEY`, the app uses its local planning logic. With a valid key and network access, it attempts to use Gemini and falls back to local planning if the request fails.

## Tests

Run:
```bash
python -m unittest discover -s tests -v
```

The tests cover page loading, health endpoint, plan creation, input validation, budget totals, timeline date suggestions, and empty chat messages.

## API reference

All endpoints return JSON. Requests that contain a body should use `Content-Type: application/json`.

### `GET /api/health`

Checks that the app is responding. The response indicates whether a Gemini key is configured; it does not verify that the key is valid.

```json
{"ok": true, "ai_configured": false}
```

### `POST /api/plan`

Creates a plan. `event_type` must be `wedding`, `birthday`, or `community`, and `guests` is required. `budget` is optional: omit it for an automatic estimate, or pass a positive number to use your own total. Other fields are optional.

```json
{
  "event_type": "birthday",
  "guests": 50,
  "currency": "INR",
  "style": "colorful",
  "event_date": "2027-05-15",
  "location": "Bhopal",
  "notes": "Include vegetarian options"
}
```

The response includes `title`, `summary`, `theme`, `budget`, `budget_estimate`, `timeline`, `vendors`, `ideas`, and `assumptions`, plus `mode` (`gemini` or `local`). `budget_estimate` identifies the amount, currency, estimate date, and basis. Invalid input returns HTTP `400` with an `error` message.

### `POST /api/chat`

Asks the planning assistant a question. `event` is optional; when provided, it may contain the same event fields accepted by `/api/plan`.

```json
{
  "message": "How can I reduce decoration costs?",
  "event": {
    "event_type": "birthday",
    "budget": 50000,
    "guests": 50,
    "currency": "INR"
  }
}
```

The response contains `answer` and `mode` (`gemini` or `local`). An empty message returns HTTP `400` with an `error` message.

## How the logic works

1. The user selects an event type and enters their event details.
2. The server validates and normalizes inputs.
3. If Gemini is configured, the app asks it for a structured JSON plan and validates the response shape.
4. If no total is supplied, the app estimates a planning budget using built-in per-guest and fixed-cost benchmarks, with an additional city-tier factor for recognized Indian cities when using INR. The budget allocation is normalized to that estimate (or to the user's supplied budget).
5. If AI is not configured or the request fails, a transparent local template produces an event-specific starter plan.
6. The browser renders the plan, lets the user edit and reorder tasks and vendors, record actual costs, and tracks completion.
7. Plans and progress are stored locally in the browser; users can keep multiple plans and export JSON/CSV or print / save as PDF.

## Assumptions and limitations

- Automatic budgets use built-in planning benchmarks, not a live price feed; they are not current vendor quotes and may differ substantially from local market prices. The estimate date is the date it was generated, not a claim that the underlying benchmarks were refreshed that day.
- Recognized Indian metro/tier-city adjustments are rough location factors; other locations use the base benchmark.
- Vendor names, availability, prices, permissions, and bookings are not verified.
- Queueing, booking, payment, email, calendar, and live vendor integrations are not implemented.
- Plans and progress use browser local storage; they are limited to that browser and are not synced across devices.
- The application does not replace professional advice for permits, food safety, security, medical needs, or emergency planning.
- Dates are planning suggestions and should be reviewed by the event organizer.
- Gemini responses can be incorrect; review all AI-generated suggestions before acting.

## Security and responsible use

- API keys are read from an environment variable and must never be committed.
- Inputs are length-limited and validated on the server.
- User-generated content is inserted into the page as text or HTML-escaped strings.
- Do not enter sensitive personal information about guests.
- For a public deployment, add rate limiting, CSRF protections where applicable, production server configuration, privacy disclosures, and stricter API quotas.

## Repository submission checklist

- [ ] Public repository.
- [ ] Only one branch (for example, `main`).
- [ ] Repository size below 10 MB.
- [ ] No `.env`, API keys, virtual environment, or cache files committed.
- [ ] Tests pass.
- [ ] README instructions verified on a clean environment.

## Suggested future improvements

- Save plans to a database and support user accounts.
- Export plans to calendar formats.
- Compare real vendor quotes entered by the user.
- Add collaborative planning and task ownership.
- Add verified venue, transit, weather, and vendor integrations.
- Improve multilingual support and accessibility testing.
