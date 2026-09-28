const empty = {};
export default empty;
export const join = (...p: string[]) => p.join("/");
export const resolve = (...p: string[]) => p.join("/");
export const dirname = (p: string) => p.replace(/\/[^/]*$/, "");
export const fileURLToPath = (u: string) => u;
export const readFileSync = () => {
  throw new Error("fs not available");
};
export const existsSync = () => false;
export const createRequire = () => () => ({});
