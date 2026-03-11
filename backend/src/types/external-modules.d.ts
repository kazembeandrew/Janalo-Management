declare module 'swagger-jsdoc' {
  const swaggerJSDoc: any;
  export default swaggerJSDoc;
}

declare module 'swagger-ui-express' {
  export const serve: any;
  export const setup: any;
}

declare module 'apollo-server-express' {
  export const gql: any;
  export class ApolloServer {
    constructor(config: any);
    start(): Promise<void>;
    applyMiddleware(config: any): void;
    stop(): Promise<void>;
  }
}

declare module 'zod' {
  export namespace z {
    export type ZodSchema<T = any> = any;
    export type ZodError = any;
  }

  export const z: any;
}
