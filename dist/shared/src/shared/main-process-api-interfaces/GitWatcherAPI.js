export var GitWatcherEvents;
(function (GitWatcherEvents) {
    GitWatcherEvents["WATCH_REPOSITORY"] = "git-watcher:watch";
    GitWatcherEvents["UNWATCH_REPOSITORY"] = "git-watcher:unwatch";
    GitWatcherEvents["GET_STATUS"] = "git-watcher:get-status";
    GitWatcherEvents["GET_ALL_STATUSES"] = "git-watcher:get-all-statuses";
    GitWatcherEvents["REFRESH_STATUS"] = "git-watcher:refresh-status";
    GitWatcherEvents["STATUS_UPDATE"] = "git:status-update";
})(GitWatcherEvents || (GitWatcherEvents = {}));
