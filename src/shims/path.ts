// Browser shim for node:path (posix only).
import p from 'path-browserify';
export const posix = p;
export const win32 = p;
export const { join, resolve, basename, dirname, extname, isAbsolute, relative, normalize, sep } = p;
export default p;
