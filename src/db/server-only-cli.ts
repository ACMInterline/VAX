/**
 * Next.js replaces the `server-only` marker while bundling the application.
 * Standalone database scripts already run exclusively in Node, so their scoped
 * tsconfig maps that marker here without weakening the application build.
 */
export {};
