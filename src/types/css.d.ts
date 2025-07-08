declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Allow importing CSS for side-effects as many files do
declare module '*.css?inline';