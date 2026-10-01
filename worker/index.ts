import handler from "vinext/server/app-router-entry";

import { noticeApi } from "./notices";

const worker = {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (["/quarterly-notice", "/quarterly-notice/"].includes(new URL(request.url).pathname)) {
      return new Response(null, { status: 302, headers: { Location: "/quarterly-notice.html" } });
    }
    if (new URL(request.url).pathname.startsWith("/api/notices/")) return noticeApi(request, env);
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
