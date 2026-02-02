declare module "ltijs" {
  import { Express, Request, Response, NextFunction } from "express";

  export class Provider {
    static app: Express;
    static setup(key: string, plugin: any, options: any): void;
    static onConnect(
      callback: (token: any, req: Request, res: Response) => Promise<any>,
    ): void;
    static onDynamicRegistration(
      callback: (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => Promise<any>,
    ): void;
    static deploy(options: {
      port?: number;
      serverless?: boolean;
    }): Promise<void>;
    static registerPlatform(config: any): Promise<void>;
    static NamesAndRoles: {
      getMembers(token: any): Promise<any>;
    };
    static DynamicRegistration: {
      register(
        openidConfiguration: string,
        registrationToken: string,
      ): Promise<any>;
    };
  }
}

declare module "ltijs-sequelize" {
  class Database {
    constructor(database: string, user: string, password: string, options: any);
  }
  export = Database;
}
