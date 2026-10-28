import unittest
from datetime import date, timedelta
from app import app, make_fallback_plan, validate_event

class EventWiseTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_homepage_loads(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"EventWise", response.data)

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["ok"])

    def test_plan_endpoint_returns_plan(self):
        response = self.client.post("/api/plan", json={
            "event_type": "birthday", "budget": 50000, "guests": 50,
            "currency": "INR", "style": "colorful"
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn("budget", response.json)
        self.assertIn("timeline", response.json)
        self.assertIn("vendors", response.json)
        self.assertEqual(response.json["budget_estimate"]["amount"], 50000)
        self.assertFalse(response.json["budget_estimate"]["estimated"])

    def test_plan_endpoint_estimates_budget_when_omitted(self):
        response = self.client.post("/api/plan", json={
            "event_type": "birthday", "guests": 50, "currency": "INR"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["budget_estimate"]["amount"], 60000)
        self.assertTrue(response.json["budget_estimate"]["estimated"])
        self.assertAlmostEqual(sum(item["amount"] for item in response.json["budget"]), 60000, places=2)

    def test_estimated_budget_accounts_for_metro_location(self):
        base = validate_event({"event_type": "birthday", "guests": 50})
        metro = validate_event({"event_type": "birthday", "guests": 50, "location": "Mumbai"})
        self.assertGreater(metro["budget"], base["budget"])

    def test_rejects_invalid_budget(self):
        response = self.client.post("/api/plan", json={
            "event_type": "wedding", "budget": -5, "guests": 10
        })
        self.assertEqual(response.status_code, 400)

    def test_rejects_non_finite_budget(self):
        with self.assertRaises(ValueError):
            validate_event({"event_type": "birthday", "budget": float("nan"), "guests": 10})

    def test_rejects_past_event_date(self):
        with self.assertRaisesRegex(ValueError, "today or a future date"):
            validate_event({
                "event_type": "birthday", "budget": 1000, "guests": 10,
                "event_date": "2000-01-01"
            })

    def test_timeline_dates_span_to_event_date(self):
        target = date.today() + timedelta(days=30)
        event = validate_event({
            "event_type": "birthday", "budget": 1000, "guests": 10,
            "event_date": target.isoformat()
        })
        dates = [date.fromisoformat(item["date"]) for item in make_fallback_plan(event)["timeline"]]
        self.assertEqual(dates[0], date.today())
        self.assertEqual(dates[-1], target)
        self.assertEqual(dates, sorted(dates))

    def test_rejects_invalid_event_type(self):
        with self.assertRaises(ValueError):
            validate_event({"event_type": "concert", "budget": 1000, "guests": 10})

    def test_budget_allocations_sum_to_total(self):
        event = validate_event({"event_type": "community", "budget": 10000, "guests": 100})
        plan = make_fallback_plan(event)
        self.assertAlmostEqual(sum(x["amount"] for x in plan["budget"]), 10000, places=2)

    def test_chat_rejects_empty_message(self):
        response = self.client.post("/api/chat", json={"message": "   "})
        self.assertEqual(response.status_code, 400)

if __name__ == "__main__":
    unittest.main()
