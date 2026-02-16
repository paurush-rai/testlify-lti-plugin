declare module "ltijs" {
  export class Provider {
    constructor(key: string, database: any, options?: any);
    deploy(options?: any): Promise<void>;
    app: any;
    Database: any;
    NamesAndRoles: any;
    Grade: any;
    getPlatformById(id: string): Promise<any>;
    onConnect(
      callback: (token: any, req: any, res: any) => Promise<void> | void,
      options?: any,
    ): void;
    redirect(response: any, path: string, options?: { newTab?: boolean }): void;
  }
}
