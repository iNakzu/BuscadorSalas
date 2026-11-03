import threading
import time
import unittest
from unittest.mock import Mock

from app.services.schedule import DataManager


class DataManagerRefreshTests(unittest.TestCase):
    def make_manager(self):
        manager = DataManager.__new__(DataManager)
        manager.cache = {"data": {"allSalasUdps": {"edges": [{"node": {"place": "OLD"}}]}}}
        manager._sync_lock = threading.Lock()
        manager._last_sync_attempt = time.monotonic()
        manager.ttl_seconds = 1800
        manager._download_remote = Mock()
        return manager

    def test_get_classes_refreshes_remote_feed_after_cache_ttl(self):
        manager = self.make_manager()

        def refresh():
            manager.cache = {"data": {"allSalasUdps": {"edges": [{"node": {"place": "NEW"}}]}}}
            return True

        manager._download_remote.side_effect = refresh
        manager._last_sync_attempt -= manager.ttl_seconds + 1

        classes = manager.get_classes()

        self.assertEqual(classes[0]["node"]["place"], "NEW")
        manager._download_remote.assert_called_once()

    def test_get_classes_uses_fresh_cache_without_remote_request(self):
        manager = self.make_manager()

        classes = manager.get_classes()

        self.assertEqual(classes[0]["node"]["place"], "OLD")
        manager._download_remote.assert_not_called()


if __name__ == "__main__":
    unittest.main()
