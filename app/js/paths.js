// Resolve assets from the application root, including GitHub Pages subpaths.
export const appUrl=path=>new URL(path,new URL('../',import.meta.url)).href;
