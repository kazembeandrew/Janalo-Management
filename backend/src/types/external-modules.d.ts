declare module 'zod' {
  export namespace z {
    export type ZodError = any;
    export type ZodSchema<T = any> = any;
    export type ZodTypeAny = any;
  }
  export const z: any;
}

declare module 'swagger-jsdoc' {
  const swaggerJsdoc: any;
  export default swaggerJsdoc;
}

declare module 'swagger-ui-express' {
  const swaggerUi: any;
  export default swaggerUi;
}

declare module 'apollo-server-express' {
  export const gql: any;
  export const ApolloServer: any;
}
