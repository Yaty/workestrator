export function removeElements(...args: any[]) {
    for (const array of args) {
        while (array.length) {
            array.pop();
        }
    }
}

export function isNil(o: any) {
    return typeof o === "undefined" || o === null;
}

export function isPositive(o: any) {
    return typeof o === "number" && o > 0;
}

export function isNegative(o: any) {
    return typeof o === "number" && o < 0;
}
