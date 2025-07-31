function isRunningInApp() {
    if (typeof window === "undefined") {
        return false;
    }

    const searchParamsString = window.location?.search;
    const params = new URLSearchParams(searchParamsString);

    return params.get("v") === "app"
}

export default {
    isRunningInApp: isRunningInApp()
};
