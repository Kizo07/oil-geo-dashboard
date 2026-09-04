import unittest
from unittest.mock import AsyncMock, Mock, patch

import app
from collectors import ais as ais_collector


class _StopLoop(Exception):
    pass


class _FakeSocket:
    def __init__(self):
        self.subscription = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def send(self, subscription):
        self.subscription = subscription


def _zone(count: int) -> dict:
    return {
        "name": "Strait of Hormuz",
        "bbox": [[24.9, 54.9], [27.0, 57.5]],
        "center": [56.2, 25.95],
        "zoom": 7.6,
        "count": count,
        "n_moving": count,
        "n_anchored": 0,
        "avg_sog": 12.0 if count else None,
        "vessels": [
            {
                "mmsi": 123456789,
                "name": "TEST VESSEL",
                "lat": 26.0,
                "lon": 56.0,
                "sog": 12.0,
                "cog": 90.0,
                "nav_status": "underway (engine)",
            }
        ] if count else [],
    }


class AisLoopResilienceTests(unittest.IsolatedAsyncioTestCase):
    async def test_empty_collection_retains_last_successful_snapshot(self):
        previous = {
            "status": "ok",
            "as_of": "2026-08-21T20:00:00Z",
            "window_s": 45,
            "zones": {"hormuz": _zone(1)},
        }
        current = {
            "status": "empty",
            "data": {
                "status": "empty",
                "as_of": "2026-08-21T20:05:00Z",
                "window_s": 45,
                "zones": {"hormuz": _zone(0)},
                "note": "provider accepted the subscription but delivered no positions",
            },
            "errors": ["provider accepted the subscription but delivered no positions"],
        }
        put = Mock()

        with (
            patch.object(app.ais, "collect", new=AsyncMock(return_value=current)),
            patch.object(app.cache, "get_stale", return_value=previous),
            patch.object(app.cache, "get", return_value=None),
            patch.object(app.cache, "put", put),
            patch.object(app.asyncio, "sleep", new=AsyncMock(side_effect=_StopLoop)),
        ):
            with self.assertRaises(_StopLoop):
                await app._ais_loop()

        put.assert_called_once()
        cache_key, stored = put.call_args.args
        self.assertEqual(cache_key, "ais_only")
        self.assertEqual(stored["status"], "stale")
        self.assertEqual(stored["provider_status"], "empty")
        self.assertTrue(stored["stale"])
        self.assertEqual(stored["last_success_at"], "2026-08-21T20:00:00Z")
        self.assertEqual(stored["last_attempt_at"], "2026-08-21T20:05:00Z")
        self.assertEqual(stored["zones"]["hormuz"]["count"], 1)

    async def test_successful_collection_clears_stale_health_metadata(self):
        previous = {
            "status": "stale",
            "provider_status": "empty",
            "stale": True,
            "as_of": "2026-08-21T20:00:00Z",
            "last_success_at": "2026-08-21T20:00:00Z",
            "last_attempt_at": "2026-08-21T20:05:00Z",
            "zones": {"hormuz": _zone(1)},
        }
        current = {
            "status": "ok",
            "data": {
                "status": "ok",
                "as_of": "2026-08-21T20:10:00Z",
                "window_s": 45,
                "zones": {"hormuz": _zone(1)},
            },
            "errors": [],
        }

        stored = app._merge_ais_snapshot(previous, current)

        self.assertEqual(stored["status"], "ok")
        self.assertEqual(stored.get("provider_status"), "ok")
        self.assertFalse(stored.get("stale"))
        self.assertEqual(stored.get("last_attempt_at"), "2026-08-21T20:10:00Z")
        self.assertEqual(stored.get("last_success_at"), "2026-08-21T20:10:00Z")

    async def test_unexpected_collector_exception_also_retains_last_snapshot(self):
        previous = {
            "status": "ok",
            "as_of": "2026-08-21T20:00:00Z",
            "window_s": 45,
            "zones": {"hormuz": _zone(1)},
        }
        put = Mock()

        with (
            patch.object(app.ais, "collect", new=AsyncMock(side_effect=RuntimeError("upstream failed"))),
            patch.object(app.cache, "get_stale", return_value=previous),
            patch.object(app.cache, "get", return_value=None),
            patch.object(app.cache, "put", put),
            patch.object(app.asyncio, "sleep", new=AsyncMock(side_effect=_StopLoop)),
        ):
            with self.assertRaises(_StopLoop):
                await app._ais_loop()

        _, stored = put.call_args.args
        self.assertEqual(stored.get("status"), "stale")
        self.assertEqual(stored.get("provider_status"), "error")
        self.assertEqual(stored.get("zones", {}).get("hormuz", {}).get("count"), 1)
        self.assertIn("RuntimeError", stored.get("note", ""))

    async def test_repeated_failures_use_capped_exponential_retry_delays(self):
        current = {
            "status": "empty",
            "data": {
                "status": "empty",
                "as_of": "2026-08-21T20:05:00Z",
                "window_s": 45,
                "zones": {"hormuz": _zone(0)},
                "note": "provider accepted the subscription but delivered no positions",
            },
            "errors": ["provider accepted the subscription but delivered no positions"],
        }
        sleep = AsyncMock(side_effect=[None, None, None, _StopLoop])

        with (
            patch.object(app.ais, "collect", new=AsyncMock(return_value=current)),
            patch.object(app.cache, "get_stale", return_value=None),
            patch.object(app.cache, "get", return_value=None),
            patch.object(app.cache, "put"),
            patch.object(app.asyncio, "sleep", new=sleep),
        ):
            with self.assertRaises(_StopLoop):
                await app._ais_loop()

        self.assertEqual(
            [call.args[0] for call in sleep.await_args_list],
            [60, 120, 240, 300],
        )

    async def test_unchanged_outage_does_not_refresh_every_other_collector(self):
        current = {
            "status": "empty",
            "data": {
                "status": "empty",
                "as_of": "2026-08-21T20:05:00Z",
                "window_s": 45,
                "zones": {"hormuz": _zone(0)},
                "note": "provider accepted the subscription but delivered no positions",
            },
            "errors": ["provider accepted the subscription but delivered no positions"],
        }
        dashboard = {
            "ais": {
                "status": "empty",
                "provider_status": "empty",
                "stale": False,
                "as_of": "2026-08-21T20:00:00Z",
                "last_attempt_at": "2026-08-21T20:00:00Z",
                "last_success_at": None,
                "zones": {"hormuz": _zone(0)},
                "note": "provider accepted the subscription but delivered no positions",
            }
        }
        spawn = Mock()

        with (
            patch.object(app.ais, "collect", new=AsyncMock(return_value=current)),
            patch.object(app.cache, "get_stale", return_value=dashboard["ais"]),
            patch.object(app.cache, "get", return_value=dashboard),
            patch.object(app.cache, "put"),
            patch.object(app, "_refresh", new=Mock(return_value=object())),
            patch.object(app, "_spawn", spawn),
            patch.object(app.asyncio, "sleep", new=AsyncMock(side_effect=_StopLoop)),
        ):
            with self.assertRaises(_StopLoop):
                await app._ais_loop()

        spawn.assert_not_called()


class AisCollectorHealthTests(unittest.IsolatedAsyncioTestCase):
    async def test_silent_provider_response_is_explained_in_cached_data(self):
        socket = _FakeSocket()
        with (
            patch.object(ais_collector, "AIS_COLLECT_WINDOW_S", 0),
            patch.object(ais_collector.websockets, "connect", return_value=socket),
        ):
            result = await ais_collector.collect("configured-test-value")

        self.assertEqual(result["status"], "empty")
        self.assertIn("accepted", result["data"].get("note", ""))
        self.assertIn("delivered no positions", result["data"]["note"])

    async def test_provider_error_cannot_echo_configured_access_value(self):
        configured_value = "configured-test-value"
        with patch.object(
            ais_collector.websockets,
            "connect",
            side_effect=RuntimeError(f"connection rejected {configured_value}"),
        ):
            result = await ais_collector.collect(configured_value)

        rendered = repr(result)
        self.assertNotIn(configured_value, rendered)
        self.assertIn("[redacted]", rendered)


if __name__ == "__main__":
    unittest.main()
