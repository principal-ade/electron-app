export var AgentInstallationEvents;
(function (AgentInstallationEvents) {
    AgentInstallationEvents["INSTALL"] = "agent:install";
    AgentInstallationEvents["INSTALL_PROGRESS"] = "agent:install-progress";
    AgentInstallationEvents["INSTALL_COMPLETE"] = "agent:install-complete";
    AgentInstallationEvents["INSTALL_ERROR"] = "agent:install-error";
    AgentInstallationEvents["CHECK_INSTALLATION"] = "agent:check-installation";
    AgentInstallationEvents["UNINSTALL"] = "agent:uninstall";
    AgentInstallationEvents["UNINSTALL_COMPLETE"] = "agent:uninstall-complete";
    AgentInstallationEvents["CHECK_FOR_UPDATES"] = "agent:check-for-updates";
    AgentInstallationEvents["GET_AVAILABLE_VERSIONS"] = "agent:get-available-versions";
    AgentInstallationEvents["GET_LATEST_VERSION"] = "agent:get-latest-version";
    AgentInstallationEvents["UPDATE"] = "agent:update";
})(AgentInstallationEvents || (AgentInstallationEvents = {}));
