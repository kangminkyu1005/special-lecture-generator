import handler from "vinext/server/app-router-entry";

const worker = {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
