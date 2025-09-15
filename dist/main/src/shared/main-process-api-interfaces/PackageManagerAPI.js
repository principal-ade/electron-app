export var PackageManagerAPIEvent;
(function (PackageManagerAPIEvent) {
    PackageManagerAPIEvent["CHECK_VERSIONS"] = "package-manager:check-versions";
    PackageManagerAPIEvent["CHECK_VULNERABILITIES"] = "package-manager:check-vulnerabilities";
    PackageManagerAPIEvent["CHECK_LICENSES"] = "package-manager:check-licenses";
    PackageManagerAPIEvent["VERSION_CHECK_PROGRESS"] = "package-manager:version-check-progress";
    PackageManagerAPIEvent["VULNERABILITY_CHECK_PROGRESS"] = "package-manager:vulnerability-check-progress";
    PackageManagerAPIEvent["LICENSE_CHECK_PROGRESS"] = "package-manager:license-check-progress";
})(PackageManagerAPIEvent || (PackageManagerAPIEvent = {}));
