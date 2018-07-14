export function removeElements(...args: any[]) {
    for (const array of args) {
        while (array.length) {
            array.pop();
        }
    }
}
