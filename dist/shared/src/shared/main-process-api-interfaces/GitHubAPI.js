export var GitHubAPIEvent;
(function (GitHubAPIEvent) {
    GitHubAPIEvent["DETECT_REPOSITORY"] = "github:detect-repository";
    GitHubAPIEvent["GET_ISSUES"] = "github:get-issues";
    GitHubAPIEvent["CREATE_ISSUE"] = "github:create-issue";
    //GET_PULL_REQUESTS = 'github:get-pull-requests',
    //GET_THREAD = 'github:get-thread',
    GitHubAPIEvent["REFRESH_DATA"] = "github:refresh-data";
    GitHubAPIEvent["CHECK_AUTH_STATUS"] = "github:check-auth-status";
    GitHubAPIEvent["GET_CHANGED_FILES"] = "github:get-changed-files";
    GitHubAPIEvent["GET_MARKDOWN_DOCUMENTS"] = "github:get-markdown-documents";
    GitHubAPIEvent["GET_FILE_CONTENT"] = "github:get-file-content";
    GitHubAPIEvent["GET_FILE_AGES"] = "github:get-file-ages";
    GitHubAPIEvent["GET_TREE"] = "github:get-tree";
    // Config fetching events (formerly ConfigAPI)
    GitHubAPIEvent["FETCH_REMOTE_CONFIG"] = "github:fetch-remote-config";
    GitHubAPIEvent["FETCH_GITHUB_CONFIG"] = "github:fetch-github-config";
})(GitHubAPIEvent || (GitHubAPIEvent = {}));
