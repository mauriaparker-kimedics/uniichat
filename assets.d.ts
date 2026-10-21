// Files that Bun imports with `with { type: "text" }` (their contents) or
// `with { type: "file" }` (the path they are served from).
declare module "*.md" { const value: string; export default value; }
declare module "*.swift" { const value: string; export default value; }
declare module "*.sh" { const value: string; export default value; }
declare module "*.css" { const value: string; export default value; }
declare module "*.svg" { const value: string; export default value; }
declare module "*.jpg" { const value: string; export default value; }
declare module "*.png" { const value: string; export default value; }
declare module "*/app.js" { const value: string; export default value; }
