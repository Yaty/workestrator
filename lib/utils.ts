export function isNotNil(o: any) {
    return typeof o !== "undefined" && o !== null;
}

export function isPositive(o: any) {
    return typeof o === "number" && o > 0;
}
