export var GitEvents;
(function (GitEvents) {
    GitEvents["GET_REPOSITORY_INFO"] = "git:get-repository-info";
    GitEvents["CHECK_IF_PRIVATE_REPO"] = "git:check-if-private-repo";
    GitEvents["GET_STATUS"] = "git:get-status";
    GitEvents["GET_DETAILED_CHANGES"] = "git:get-detailed-changes";
    GitEvents["GET_UNCOMMITTED_CHANGES"] = "git:get-uncommitted-changes";
    GitEvents["STAGE_FILES"] = "git:stage-files";
    GitEvents["CREATE_COMMIT"] = "git:create-commit";
    GitEvents["EXECUTE_COMMAND"] = "git:exec-command";
    GitEvents["CLONE_REPOSITORY"] = "git:clone-repository";
    GitEvents["CHECK_AUTH_METHODS"] = "git:check-auth-methods";
    GitEvents["DELETE_GIT_REPOSITORY"] = "git:delete-git-repository";
    GitEvents["FORCE_DELETE_GIT_REPOSITORY"] = "git:force-delete-git-repository";
})(GitEvents || (GitEvents = {}));
