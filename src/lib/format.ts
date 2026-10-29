// Display formatting shared by server and client components.
export function baht(value: number): string {
    return `฿${Math.round(value).toLocaleString("en-US")}`;
}