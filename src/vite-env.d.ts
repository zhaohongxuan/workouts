/// <reference types="vite/client" />

declare module '*.yml' {
  const data: unknown
  export default data
}

declare module '*.yaml' {
  const data: unknown
  export default data
}

declare module '@config' {
  const data: unknown
  export default data
}
