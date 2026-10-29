// Browser shim for node:fs. The extension never touches a filesystem; rules that need one are disabled.
const no = () => { throw new Error('filesystem not available in the browser'); };
export const existsSync = () => false;
export const readdirSync = () => [];
export const readFile = no, readdir = no, stat = no, access = no, writeFile = no, mkdir = no, lstat = no, realpath = no, readlink = no, open = no, rm = no, rename = no;
export const promises = { readFile, readdir, stat, access };
export default { existsSync, readdirSync, promises };
