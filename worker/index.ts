import handler from "vinext/server/app-router-entry";

import { noticeApi } from "./notices";

const worker = {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/api/notices/")) return noticeApi(request, env);
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
